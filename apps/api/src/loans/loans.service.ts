import type {
  Loan as LoanDto,
  LoanDirection,
  LoansOverview,
  LoanStatus,
  LoanTotals,
} from '@expense/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { sumMoney, toMoney } from '../common/finance/money';
import { fromDbDate, PlainDate, toDbDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CreateLoanDto,
  CreateRepaymentDto,
  UpdateLoanDto,
  UpdateRepaymentDto,
} from './dto/loans.dto';
import { loanBalance } from './loan-math';
import {
  applyFunding,
  type FundingLinks,
  NO_FUNDING,
  planFunding,
  removeLinkedRecords,
} from './repayment-funding';

const withRepayments = {
  repayments: {
    orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    include: {
      transaction: { select: { amount: true } },
      savingsEntry: { select: { amount: true } },
      fundingLoan: { select: { id: true, counterparty: true } },
    },
  },
} satisfies Prisma.LoanInclude;

type LoanWithRepayments = Prisma.LoanGetPayload<{ include: typeof withRepayments }>;
type Repayment = LoanWithRepayments['repayments'][number];

const linksOf = (r: Repayment): FundingLinks => ({
  source: r.source,
  sourceNote: r.sourceNote,
  transactionId: r.transactionId,
  savingsEntryId: r.savingsEntryId,
  fundingLoanId: r.fundingLoanId,
});

const STATUS_ORDER: Record<LoanStatus, number> = { overdue: 0, active: 1, paid: 2 };

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async overview(userId: string): Promise<LoansOverview> {
    const { today } = await this.users.today(userId);
    const rows = await this.prisma.loan.findMany({ where: { userId }, include: withRepayments });
    const loans = rows.map((l) => toLoanDto(l, today));

    // Overdue first, then active by nearest due date, then paid off.
    loans.sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
        b.loanDate.localeCompare(a.loanDate),
    );

    return {
      totals: { BORROWED: totalsFor(loans, 'BORROWED'), LENT: totalsFor(loans, 'LENT') },
      loans,
    };
  }

  async create(userId: string, dto: CreateLoanDto): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const loanDate = dto.loanDate ?? today;
    const dueDate = dto.dueDate ?? null;
    assertDueAfterLoanDate(loanDate, dueDate);

    const loan = await this.prisma.loan.create({
      data: {
        userId,
        direction: dto.direction ?? 'BORROWED',
        counterparty: dto.counterparty,
        amount: new Prisma.Decimal(dto.amount),
        loanDate: toDbDate(loanDate),
        dueDate: dueDate ? toDbDate(dueDate) : null,
        notes: dto.notes || null,
      },
      include: withRepayments,
    });
    return toLoanDto(loan, today);
  }

  async update(userId: string, id: string, dto: UpdateLoanDto): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const loan = await this.prisma.$transaction(async (tx) => {
      const existing = await lockOwnedLoan(tx, userId, id);
      const loanDate = dto.loanDate ?? fromDbDate(existing.loanDate);
      const dueDate =
        dto.dueDate === undefined ? existing.dueDate && fromDbDate(existing.dueDate) : dto.dueDate;
      assertDueAfterLoanDate(loanDate, dueDate);

      if (
        dto.amount !== undefined &&
        new Prisma.Decimal(dto.amount).lt(sumMoney(existing.repayments.map((r) => r.amount)))
      ) {
        throw new BadRequestException(
          'The amount cannot be less than what has already been repaid',
        );
      }
      const earliest = existing.repayments.at(-1);
      if (earliest && loanDate > fromDbDate(earliest.paidOn)) {
        throw new BadRequestException('The loan date cannot be after the first repayment');
      }

      return tx.loan.update({
        where: { id },
        data: {
          ...(dto.counterparty !== undefined ? { counterparty: dto.counterparty } : {}),
          ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
          loanDate: toDbDate(loanDate),
          dueDate: dueDate ? toDbDate(dueDate) : null,
        },
        include: withRepayments,
      });
    });
    return toLoanDto(loan, today);
  }

  /**
   * Deletes the loan and its repayments, and undoes the expenses and savings withdrawals those
   * repayments recorded. A loan taken to fund a repayment is removed too unless it has
   * repayments of its own, in which case it stays as an ordinary loan.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const loan = await lockOwnedLoan(tx, userId, id);
      for (const repayment of loan.repayments) {
        const links = linksOf(repayment);
        const fundingLoan = links.fundingLoanId
          ? await tx.loan.findFirst({
              where: { id: links.fundingLoanId, userId },
              include: { _count: { select: { repayments: true } } },
            })
          : null;
        await removeLinkedRecords(tx, userId, links, {
          keepLoan: !fundingLoan || fundingLoan._count.repayments > 0,
        });
      }
      await tx.loan.delete({ where: { id } });
    });
  }

  async addRepayment(userId: string, id: string, dto: CreateRepaymentDto): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const paidOn = dto.paidOn ?? today;
    const amount = new Prisma.Decimal(dto.amount);

    const loan = await this.prisma.$transaction(async (tx) => {
      // The row lock serialises concurrent repayments so the loan can never be overpaid.
      const existing = await lockOwnedLoan(tx, userId, id);
      if (paidOn < fromDbDate(existing.loanDate)) {
        throw new BadRequestException('A repayment cannot be dated before the loan date');
      }
      const { outstanding } = loanBalance(
        existing.amount,
        existing.repayments.map((r) => r.amount),
        null,
        today,
      );
      if (outstanding.lte(0)) throw new BadRequestException('This loan is already fully repaid');
      if (amount.gt(outstanding)) {
        throw new BadRequestException(
          `The repayment is more than the ${toMoney(outstanding)} outstanding`,
        );
      }

      let links = NO_FUNDING;
      if (existing.direction === 'BORROWED') {
        links = await applyFunding(
          tx,
          {
            userId,
            counterparty: existing.counterparty,
            amount,
            paidOn,
            today,
            notes: dto.notes || null,
          },
          planFunding(dto, amount),
          NO_FUNDING,
        );
      } else if (dto.source) {
        throw new BadRequestException(
          'Only repayments of borrowed money record where the money came from',
        );
      }

      await tx.loanRepayment.create({
        data: {
          loanId: id,
          amount,
          paidOn: toDbDate(paidOn),
          notes: dto.notes || null,
          ...links,
        },
      });
      return tx.loan.findUniqueOrThrow({ where: { id }, include: withRepayments });
    });
    return toLoanDto(loan, today);
  }

  async updateRepayment(
    userId: string,
    id: string,
    repaymentId: string,
    dto: UpdateRepaymentDto,
  ): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const loan = await this.prisma.$transaction(async (tx) => {
      // Same lock as adding a repayment, so an edit can never push the loan past its amount.
      const existing = await lockOwnedLoan(tx, userId, id);
      const repayment = existing.repayments.find((r) => r.id === repaymentId);
      if (!repayment) throw new NotFoundException('Repayment not found');

      const paidOn = dto.paidOn ?? fromDbDate(repayment.paidOn);
      if (paidOn < fromDbDate(existing.loanDate)) {
        throw new BadRequestException('A repayment cannot be dated before the loan date');
      }
      const amount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : repayment.amount;
      // What is left once this repayment is taken out, i.e. the most it may now be.
      const { outstanding: available } = loanBalance(
        existing.amount,
        existing.repayments.filter((r) => r.id !== repaymentId).map((r) => r.amount),
        null,
        today,
      );
      if (amount.gt(available)) {
        throw new BadRequestException(
          `The repayment is more than the ${toMoney(available)} outstanding`,
        );
      }

      const notes = dto.notes !== undefined ? dto.notes || null : repayment.notes;
      let links = linksOf(repayment);
      if (existing.direction === 'LENT') {
        if (dto.source) {
          throw new BadRequestException(
            'Only repayments of borrowed money record where the money came from',
          );
        }
      } else {
        const moved =
          !amount.eq(repayment.amount) ||
          paidOn !== fromDbDate(repayment.paidOn) ||
          notes !== repayment.notes;
        // Keep the recorded expense / withdrawal / loan in step with the repayment.
        const input = dto.source
          ? dto
          : moved && repayment.source
            ? {
                source: repayment.source,
                fundingLender: repayment.fundingLoan?.counterparty,
                sourceNote: repayment.sourceNote ?? undefined,
              }
            : null;
        if (input) {
          links = await applyFunding(
            tx,
            { userId, counterparty: existing.counterparty, amount, paidOn, today, notes },
            planFunding(input, amount),
            links,
          );
        }
      }

      await tx.loanRepayment.update({
        where: { id: repaymentId },
        data: { amount, paidOn: toDbDate(paidOn), notes, ...links },
      });
      return tx.loan.findUniqueOrThrow({ where: { id }, include: withRepayments });
    });
    return toLoanDto(loan, today);
  }

  /** Undoes the repayment and whatever it recorded (expense, savings withdrawal, new loan). */
  async removeRepayment(userId: string, id: string, repaymentId: string): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const loan = await this.prisma.$transaction(async (tx) => {
      const existing = await lockOwnedLoan(tx, userId, id);
      const repayment = existing.repayments.find((r) => r.id === repaymentId);
      if (!repayment) throw new NotFoundException('Repayment not found');
      await tx.loanRepayment.delete({ where: { id: repaymentId } });
      await removeLinkedRecords(tx, userId, linksOf(repayment));
      return tx.loan.findUniqueOrThrow({ where: { id }, include: withRepayments });
    });
    return toLoanDto(loan, today);
  }
}

async function lockOwnedLoan(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
): Promise<LoanWithRepayments> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM loans WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw new NotFoundException('Loan not found');
  return tx.loan.findUniqueOrThrow({ where: { id }, include: withRepayments });
}

function assertDueAfterLoanDate(loanDate: PlainDate, dueDate: PlainDate | null) {
  if (dueDate && dueDate < loanDate) {
    throw new BadRequestException('The due date must be on or after the loan date');
  }
}

function totalsFor(loans: LoanDto[], direction: LoanDirection): LoanTotals {
  const side = loans.filter((l) => l.direction === direction);
  return {
    amount: toMoney(sumMoney(side.map((l) => l.amount))),
    repaid: toMoney(sumMoney(side.map((l) => l.repaid))),
    outstanding: toMoney(sumMoney(side.map((l) => l.outstanding))),
    activeCount: side.filter((l) => l.status !== 'paid').length,
    overdueCount: side.filter((l) => l.status === 'overdue').length,
  };
}

function toLoanDto(loan: LoanWithRepayments, today: PlainDate): LoanDto {
  const dueDate = loan.dueDate ? fromDbDate(loan.dueDate) : null;
  const balance = loanBalance(
    loan.amount,
    loan.repayments.map((r) => r.amount),
    dueDate,
    today,
  );
  return {
    id: loan.id,
    direction: loan.direction,
    counterparty: loan.counterparty,
    amount: toMoney(loan.amount),
    loanDate: fromDbDate(loan.loanDate),
    dueDate,
    notes: loan.notes,
    repaid: toMoney(balance.repaid),
    outstanding: toMoney(balance.outstanding),
    percentRepaid: balance.percentRepaid,
    status: balance.status,
    repayments: loan.repayments.map((r) => ({
      id: r.id,
      amount: toMoney(r.amount),
      paidOn: fromDbDate(r.paidOn),
      notes: r.notes,
      funding: r.source
        ? {
            source: r.source,
            fromSalary: r.transaction ? toMoney(r.transaction.amount) : null,
            transactionId: r.transactionId,
            fromSavings: r.savingsEntry ? toMoney(r.savingsEntry.amount) : null,
            savingsEntryId: r.savingsEntryId,
            loan: r.fundingLoan,
            note: r.sourceNote,
          }
        : null,
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}
