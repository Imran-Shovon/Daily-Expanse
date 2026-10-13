import type { BudgetPeriod, Budget as BudgetDto, BudgetStatus } from '@expense/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Budget, Category, Prisma } from '@prisma/client';
import { budgetPeriodFor, calculateBudgetUsage } from '../common/finance/calculations';
import { toMoney } from '../common/finance/money';
import { toCategorySummary } from '../common/mappers';
import {
  fromDbDate,
  PlainDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toDbDate,
} from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budgets.dto';

type BudgetWithCategory = Budget & { category: Category | null };

function defaultStart(period: BudgetPeriod, today: PlainDate): PlainDate {
  if (period === 'WEEKLY') return startOfWeek(today);
  if (period === 'YEARLY') return startOfYear(today);
  return startOfMonth(today);
}

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async list(userId: string, date?: PlainDate): Promise<BudgetDto[]> {
    const reference = date ?? (await this.users.today(userId)).today;
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ categoryId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    });
    return Promise.all(budgets.map((b) => this.toDto(userId, b, reference)));
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetDto> {
    const { today } = await this.users.today(userId);
    const period = dto.period ?? 'MONTHLY';
    const startDate = dto.startDate ?? defaultStart(period, today);
    const endDate = dto.endDate ?? null;
    const categoryId = dto.categoryId ?? null;

    await this.validate(userId, { categoryId, period, startDate, endDate });

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        name: dto.name || null,
        amount: new Prisma.Decimal(dto.amount),
        period,
        categoryId,
        startDate: toDbDate(startDate),
        endDate: endDate ? toDbDate(endDate) : null,
      },
      include: { category: true },
    });
    return this.toDto(userId, budget, today);
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetDto> {
    const existing = await this.findOwned(userId, id);
    const next = {
      categoryId: dto.categoryId === undefined ? existing.categoryId : dto.categoryId,
      period: dto.period ?? existing.period,
      startDate: dto.startDate ?? fromDbDate(existing.startDate),
      endDate:
        dto.endDate === undefined ? existing.endDate && fromDbDate(existing.endDate) : dto.endDate,
    };
    await this.validate(userId, next, id);

    const budget = await this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name || null } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        period: next.period,
        categoryId: next.categoryId,
        startDate: toDbDate(next.startDate),
        endDate: next.endDate ? toDbDate(next.endDate) : null,
      },
      include: { category: true },
    });
    const { today } = await this.users.today(userId);
    return this.toDto(userId, budget, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.budget.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Budget not found');
  }

  /** Budgets active on the reference date together with their usage. */
  async activeStatuses(userId: string, reference: PlainDate) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    });
    const results = await Promise.all(budgets.map((b) => this.toDto(userId, b, reference)));
    return results.filter((b): b is BudgetDto & { status: BudgetStatus } => b.status !== null);
  }

  /** Sum of EXPENSE transactions (only) inside the period, optionally limited to one category. */
  async spentBetween(
    userId: string,
    from: PlainDate,
    to: PlainDate,
    categoryId: string | null,
  ): Promise<Prisma.Decimal> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: toDbDate(from), lte: toDbDate(to) },
        ...(categoryId ? { categoryId } : {}),
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  private async toDto(
    userId: string,
    budget: BudgetWithCategory,
    reference: PlainDate,
  ): Promise<BudgetDto> {
    const window = budgetPeriodFor(
      {
        period: budget.period,
        startDate: fromDbDate(budget.startDate),
        endDate: budget.endDate ? fromDbDate(budget.endDate) : null,
      },
      reference,
    );

    let status: BudgetStatus | null = null;
    if (window) {
      const spent = await this.spentBetween(userId, window.from, window.to, budget.categoryId);
      const usage = calculateBudgetUsage(budget.amount, spent);
      status = {
        periodStart: window.from,
        periodEnd: window.to,
        spent: toMoney(usage.spent),
        remaining: toMoney(usage.remaining),
        percentUsed: usage.percentUsed,
        state: usage.state,
      };
    }

    return {
      id: budget.id,
      name: budget.name,
      amount: toMoney(budget.amount),
      period: budget.period,
      startDate: fromDbDate(budget.startDate),
      endDate: budget.endDate ? fromDbDate(budget.endDate) : null,
      category: budget.category ? toCategorySummary(budget.category) : null,
      status,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }

  private async findOwned(userId: string, id: string): Promise<Budget> {
    const budget = await this.prisma.budget.findFirst({ where: { id, userId } });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  /**
   * Category budgets must target the user's own expense category, and two budgets for the
   * same scope and period may not overlap in time (that would double count the limit).
   */
  private async validate(
    userId: string,
    b: {
      categoryId: string | null;
      period: BudgetPeriod;
      startDate: PlainDate;
      endDate: PlainDate | null;
    },
    excludeId?: string,
  ) {
    if (b.endDate && b.endDate < b.startDate) {
      throw new BadRequestException('End date must be on or after the start date');
    }
    if (b.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: b.categoryId, userId },
      });
      if (!category) throw new BadRequestException('Category not found');
      if (category.type !== 'EXPENSE') {
        throw new BadRequestException('Budgets can only track expense categories');
      }
    }

    const overlapping = await this.prisma.budget.findFirst({
      where: {
        userId,
        period: b.period,
        categoryId: b.categoryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // existing.start <= new.end AND (existing.end is null OR existing.end >= new.start)
        ...(b.endDate ? { startDate: { lte: toDbDate(b.endDate) } } : {}),
        OR: [{ endDate: null }, { endDate: { gte: toDbDate(b.startDate) } }],
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `A ${b.period.toLowerCase()} budget for this ${b.categoryId ? 'category' : 'scope'} already covers these dates`,
      );
    }
  }
}
