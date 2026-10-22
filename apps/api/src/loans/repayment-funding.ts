import type { RepaymentSource } from '@expense/shared';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { sumMoney, toMoney } from '../common/finance/money';
import { fromDbDate, type PlainDate, toDbDate } from '../common/utils/plain-date';
import { savingsBalance } from '../savings/savings-math';

/** Expense category that repayments paid from salary or income are filed under. */
export const REPAYMENT_CATEGORY = { name: 'Loan repayment', icon: 'wallet', color: '#ea580c' };

/** What the user said about where the money came from. */
export interface FundingInput {
  source?: RepaymentSource;
  fromSalary?: string;
  fromSavings?: string;
  fundingLender?: string;
  sourceNote?: string;
}

/** A validated plan: how much to record where. */
export interface FundingPlan {
  source: RepaymentSource;
  fromSalary: Prisma.Decimal | null;
  fromSavings: Prisma.Decimal | null;
  /** Lender of a new loan taken to make the repayment. */
  lender: string | null;
  note: string | null;
}

/** The records a repayment created, as stored on the repayment. */
export interface FundingLinks {
  source: RepaymentSource | null;
  sourceNote: string | null;
  transactionId: string | null;
  savingsEntryId: string | null;
  fundingLoanId: string | null;
}

export const NO_FUNDING: FundingLinks = {
  source: null,
  sourceNote: null,
  transactionId: null,
  savingsEntryId: null,
  fundingLoanId: null,
};

export function planFunding(input: FundingInput, amount: Prisma.Decimal): FundingPlan {
  const plan: FundingPlan = {
    source: input.source!,
    fromSalary: null,
    fromSavings: null,
    lender: null,
    note: null,
  };
  switch (input.source) {
    case 'SALARY':
      return { ...plan, fromSalary: amount };
    case 'SAVINGS':
      return { ...plan, fromSavings: amount };
    case 'SALARY_AND_SAVINGS': {
      if (!input.fromSalary || !input.fromSavings) {
        throw new BadRequestException('Enter how much came from salary and how much from savings');
      }
      const fromSalary = new Prisma.Decimal(input.fromSalary);
      const fromSavings = new Prisma.Decimal(input.fromSavings);
      if (!fromSalary.plus(fromSavings).eq(amount)) {
        throw new BadRequestException(
          `The salary and savings parts must add up to the ${toMoney(amount)} repayment`,
        );
      }
      return { ...plan, fromSalary, fromSavings };
    }
    case 'LOAN':
      if (!input.fundingLender) {
        throw new BadRequestException('Enter who you borrowed the money from');
      }
      return { ...plan, lender: input.fundingLender };
    case 'OTHER':
      if (!input.sourceNote) throw new BadRequestException('Explain how you paid');
      return { ...plan, note: input.sourceNote };
    default:
      throw new BadRequestException('Choose where the money came from');
  }
}

interface FundingContext {
  userId: string;
  /** Who the repayment goes to, for titles and notes on the created records. */
  counterparty: string;
  amount: Prisma.Decimal;
  paidOn: PlainDate;
  today: PlainDate;
  notes: string | null;
}

/**
 * Records the plan (expense, savings withdrawal, new loan), first undoing what `previous`
 * created so an edit never leaves stale records behind. Runs inside the caller's transaction.
 */
export async function applyFunding(
  tx: Prisma.TransactionClient,
  ctx: FundingContext,
  plan: FundingPlan,
  previous: FundingLinks,
): Promise<FundingLinks> {
  await removeLinkedRecords(tx, ctx.userId, previous, { keepLoan: plan.lender !== null });

  let savingsEntryId: string | null = null;
  if (plan.fromSavings) {
    if (ctx.paidOn > ctx.today) {
      throw new BadRequestException('Savings can only pay for a repayment dated today or earlier');
    }
    // Same lock as savings entries, so two withdrawals can never overdraw savings.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${ctx.userId} FOR UPDATE`;
    const entries = await tx.savingsEntry.findMany({
      where: { userId: ctx.userId },
      select: { type: true, amount: true },
    });
    const balance = savingsBalance(entries);
    if (plan.fromSavings.gt(balance)) {
      throw new BadRequestException(`Your savings only have ${toMoney(balance)}`);
    }
    const entry = await tx.savingsEntry.create({
      data: {
        userId: ctx.userId,
        type: 'WITHDRAWAL',
        amount: plan.fromSavings,
        date: toDbDate(ctx.paidOn),
        purpose: 'Debt repayment',
        notes: `Loan repayment to ${ctx.counterparty}`.slice(0, 500),
      },
    });
    savingsEntryId = entry.id;
  }

  let transactionId: string | null = null;
  if (plan.fromSalary) {
    const category = await tx.category.upsert({
      where: {
        userId_type_name: {
          userId: ctx.userId,
          type: 'EXPENSE',
          name: REPAYMENT_CATEGORY.name,
        },
      },
      update: {},
      create: { userId: ctx.userId, type: 'EXPENSE', ...REPAYMENT_CATEGORY },
    });
    const transaction = await tx.transaction.create({
      data: {
        userId: ctx.userId,
        categoryId: category.id,
        type: 'EXPENSE',
        title: `Loan repayment: ${ctx.counterparty}`.slice(0, 120),
        amount: plan.fromSalary,
        date: toDbDate(ctx.paidOn),
        paymentMethod: 'OTHER',
        notes: ctx.notes,
        tags: ['loan-repayment'],
      },
    });
    transactionId = transaction.id;
  }

  let fundingLoanId: string | null = null;
  if (plan.lender) {
    fundingLoanId = await upsertFundingLoan(tx, ctx, plan.lender, previous.fundingLoanId);
  }

  return {
    source: plan.source,
    sourceNote: plan.note,
    transactionId,
    savingsEntryId,
    fundingLoanId,
  };
}

/** Undoes everything a repayment created, e.g. when the repayment itself is removed. */
export async function removeLinkedRecords(
  tx: Prisma.TransactionClient,
  userId: string,
  links: FundingLinks,
  options: { keepLoan?: boolean } = {},
): Promise<void> {
  if (links.transactionId) {
    await tx.transaction.deleteMany({ where: { id: links.transactionId, userId } });
  }
  if (links.savingsEntryId) {
    await tx.savingsEntry.deleteMany({ where: { id: links.savingsEntryId, userId } });
  }
  if (links.fundingLoanId && !options.keepLoan) {
    const loan = await tx.loan.findFirst({
      where: { id: links.fundingLoanId, userId },
      include: { _count: { select: { repayments: true } } },
    });
    if (loan && loan._count.repayments > 0) {
      throw new BadRequestException(
        `The loan from ${loan.counterparty} taken for this repayment already has repayments. Remove those first.`,
      );
    }
    if (loan) await tx.loan.delete({ where: { id: loan.id } });
  }
}

/** Keeps the new loan in step with the repayment it paid for. */
async function upsertFundingLoan(
  tx: Prisma.TransactionClient,
  ctx: FundingContext,
  lender: string,
  existingId: string | null,
): Promise<string> {
  const existing = existingId
    ? await tx.loan.findFirst({
        where: { id: existingId, userId: ctx.userId },
        include: { repayments: { orderBy: { paidOn: 'asc' } } },
      })
    : null;
  const notes = `Taken to repay ${ctx.counterparty}`.slice(0, 1000);

  if (!existing) {
    const loan = await tx.loan.create({
      data: {
        userId: ctx.userId,
        direction: 'BORROWED',
        counterparty: lender,
        amount: ctx.amount,
        loanDate: toDbDate(ctx.paidOn),
        notes,
      },
    });
    return loan.id;
  }

  const repaid = sumMoney(existing.repayments.map((r) => r.amount));
  if (ctx.amount.lt(repaid)) {
    throw new BadRequestException(
      `You have already repaid ${toMoney(repaid)} of the loan from ${existing.counterparty}`,
    );
  }
  const first = existing.repayments[0];
  if (first && ctx.paidOn > fromDbDate(first.paidOn)) {
    throw new BadRequestException(
      `The loan from ${existing.counterparty} has a repayment before this date`,
    );
  }
  await tx.loan.update({
    where: { id: existing.id },
    data: { counterparty: lender, amount: ctx.amount, loanDate: toDbDate(ctx.paidOn) },
  });
  return existing.id;
}
