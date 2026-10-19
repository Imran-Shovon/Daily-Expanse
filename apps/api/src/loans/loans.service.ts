import type { Loan as LoanDto, LoansOverview, LoanStatus } from '@expense/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Loan, LoanRepayment, Prisma } from '@prisma/client';
import { sumMoney, toMoney } from '../common/finance/money';
import { fromDbDate, PlainDate, toDbDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateLoanDto, CreateRepaymentDto, UpdateLoanDto } from './dto/loans.dto';
import { loanBalance } from './loan-math';

type LoanWithRepayments = Loan & { repayments: LoanRepayment[] };

const withRepayments = {
  repayments: { orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }] },
} satisfies Prisma.LoanInclude;

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
        b.borrowedOn.localeCompare(a.borrowedOn),
    );

    return {
      totals: {
        borrowed: toMoney(sumMoney(loans.map((l) => l.amount))),
        repaid: toMoney(sumMoney(loans.map((l) => l.repaid))),
        outstanding: toMoney(sumMoney(loans.map((l) => l.outstanding))),
        activeCount: loans.filter((l) => l.status !== 'paid').length,
        overdueCount: loans.filter((l) => l.status === 'overdue').length,
      },
      loans,
    };
  }

  async create(userId: string, dto: CreateLoanDto): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const borrowedOn = dto.borrowedOn ?? today;
    const dueDate = dto.dueDate ?? null;
    assertDueAfterBorrowed(borrowedOn, dueDate);

    const loan = await this.prisma.loan.create({
      data: {
        userId,
        lender: dto.lender,
        amount: new Prisma.Decimal(dto.amount),
        borrowedOn: toDbDate(borrowedOn),
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
      const borrowedOn = dto.borrowedOn ?? fromDbDate(existing.borrowedOn);
      const dueDate =
        dto.dueDate === undefined ? existing.dueDate && fromDbDate(existing.dueDate) : dto.dueDate;
      assertDueAfterBorrowed(borrowedOn, dueDate);

      if (
        dto.amount !== undefined &&
        new Prisma.Decimal(dto.amount).lt(sumMoney(existing.repayments.map((r) => r.amount)))
      ) {
        throw new BadRequestException(
          'The amount cannot be less than what you have already repaid',
        );
      }
      const earliest = existing.repayments.at(-1);
      if (earliest && borrowedOn > fromDbDate(earliest.paidOn)) {
        throw new BadRequestException('The borrowed date cannot be after the first repayment');
      }

      return tx.loan.update({
        where: { id },
        data: {
          ...(dto.lender !== undefined ? { lender: dto.lender } : {}),
          ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
          borrowedOn: toDbDate(borrowedOn),
          dueDate: dueDate ? toDbDate(dueDate) : null,
        },
        include: withRepayments,
      });
    });
    return toLoanDto(loan, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.loan.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Loan not found');
  }

  async addRepayment(userId: string, id: string, dto: CreateRepaymentDto): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const paidOn = dto.paidOn ?? today;
    const amount = new Prisma.Decimal(dto.amount);

    const loan = await this.prisma.$transaction(async (tx) => {
      // The row lock serialises concurrent repayments so the loan can never be overpaid.
      const existing = await lockOwnedLoan(tx, userId, id);
      if (paidOn < fromDbDate(existing.borrowedOn)) {
        throw new BadRequestException('A repayment cannot be dated before the loan was taken');
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
          `The repayment is more than the ${toMoney(outstanding)} still owed`,
        );
      }

      await tx.loanRepayment.create({
        data: { loanId: id, amount, paidOn: toDbDate(paidOn), notes: dto.notes || null },
      });
      return tx.loan.findUniqueOrThrow({ where: { id }, include: withRepayments });
    });
    return toLoanDto(loan, today);
  }

  async removeRepayment(userId: string, id: string, repaymentId: string): Promise<LoanDto> {
    const { today } = await this.users.today(userId);
    const { count } = await this.prisma.loanRepayment.deleteMany({
      where: { id: repaymentId, loanId: id, loan: { userId } },
    });
    if (count === 0) throw new NotFoundException('Repayment not found');
    const loan = await this.prisma.loan.findUniqueOrThrow({
      where: { id },
      include: withRepayments,
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

function assertDueAfterBorrowed(borrowedOn: PlainDate, dueDate: PlainDate | null) {
  if (dueDate && dueDate < borrowedOn) {
    throw new BadRequestException('The due date must be on or after the borrowed date');
  }
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
    lender: loan.lender,
    amount: toMoney(loan.amount),
    borrowedOn: fromDbDate(loan.borrowedOn),
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
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}
