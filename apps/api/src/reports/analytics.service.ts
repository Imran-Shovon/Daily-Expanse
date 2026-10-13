import {
  PAYMENT_METHOD_LABELS,
  type BudgetAlert,
  type CategoryBreakdown,
  type DashboardSummary,
  type DateRange,
  type DateRangePreset,
  type IncomeExpenseReport,
  type ReportGranularity,
  type SpendingTrends,
  type TransactionReport,
  type TransactionType,
} from '@expense/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { BudgetsService } from '../budgets/budgets.service';
import { DateRangeQueryDto } from '../common/dto/date-range-query.dto';
import {
  averageDaily,
  buildTrend,
  calculateTotals,
  DailyAmount,
  savingsRate,
} from '../common/finance/calculations';
import { toCsv } from '../common/finance/csv';
import { percentage, toDecimal, toMoney, ZERO } from '../common/finance/money';
import { toCategorySummary, toTransactionDto, TransactionWithCategory } from '../common/mappers';
import { DateRangeError, pickGranularity, resolveDateRange } from '../common/utils/date-range';
import { fromDbDate, maxDate, minDate, PlainDate, toDbDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';
import { UsersService } from '../users/users.service';
import { ExportQueryDto } from './dto/reports.dto';

const EXPORT_BATCH = 1000;
export const EXPORT_MAX_ROWS = 50_000;

interface RangeContext {
  user: User;
  today: PlainDate;
  range: DateRange;
}

/**
 * All analytics are computed from the user's transactions with database aggregation
 * (SUM over NUMERIC) and decimal arithmetic. Every query is scoped by userId.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly budgets: BudgetsService,
    private readonly recurring: RecurringService,
  ) {}

  async resolveRange(userId: string, query: DateRangeQueryDto): Promise<RangeContext> {
    const { user, today } = await this.users.today(userId);
    const preset: DateRangePreset =
      query.range ??
      (query.from && query.to ? 'custom' : (user.defaultDateRange as DateRangePreset));
    try {
      return { user, today, range: resolveDateRange(preset, today, query) };
    } catch (error) {
      if (error instanceof DateRangeError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private dateFilter(range: DateRange) {
    return { gte: toDbDate(range.from), lte: toDbDate(range.to) };
  }

  private async totals(userId: string, range: DateRange) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date: this.dateFilter(range) },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const totals = calculateTotals(groups.map((g) => ({ type: g.type, amount: g._sum.amount })));
    const count = groups.reduce((n, g) => n + g._count._all, 0);
    return { ...totals, count };
  }

  private async dailyAmounts(userId: string, range: DateRange): Promise<DailyAmount[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['date', 'type'],
      where: { userId, date: this.dateFilter(range) },
      _sum: { amount: true },
    });
    return groups.map((g) => ({ date: fromDbDate(g.date), type: g.type, amount: g._sum.amount }));
  }

  async summary(userId: string, query: DateRangeQueryDto): Promise<DashboardSummary> {
    // Catch up recurring transactions that are due, so the dashboard is current even where no
    // background scheduler runs (serverless). Idempotent and cheap when nothing is due.
    await this.recurring.processDueForUser(userId);
    const { today, range } = await this.resolveRange(userId, query);

    const [totals, cumulative, recent] = await Promise.all([
      this.totals(userId, range),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, date: { lte: toDbDate(range.to) } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId, date: this.dateFilter(range) },
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 6,
      }),
    ]);
    const cumulativeTotals = calculateTotals(
      cumulative.map((g) => ({ type: g.type, amount: g._sum.amount })),
    );

    // Budgets are evaluated on "today" when it falls inside the range, otherwise at the
    // nearest edge of the range (e.g. the last day of "last month").
    const reference = minDate(maxDate(today, range.from), range.to);
    const statuses = await this.budgets.activeStatuses(userId, reference);
    const overall = statuses.find((b) => b.category === null && b.period === 'MONTHLY');
    const alerts: BudgetAlert[] = statuses
      .filter((b) => b.status.state !== 'ok')
      .sort((a, b) => b.status.percentUsed - a.status.percentUsed)
      .map((b) => ({
        budgetId: b.id,
        name: b.name ?? (b.category ? b.category.name : 'Overall budget'),
        categoryName: b.category?.name ?? null,
        percentUsed: b.status.percentUsed,
        state: b.status.state as 'warning' | 'exceeded',
        spent: b.status.spent,
        amount: b.amount,
      }));

    return {
      range,
      totalIncome: toMoney(totals.income),
      totalExpenses: toMoney(totals.expenses),
      netBalance: toMoney(totals.net),
      cumulativeBalance: toMoney(cumulativeTotals.net),
      savingsRate: savingsRate(totals.income, totals.expenses),
      transactionCount: totals.count,
      monthlyBudget: overall
        ? { budgetId: overall.id, amount: overall.amount, status: overall.status }
        : null,
      budgetAlerts: alerts,
      recentTransactions: (recent as TransactionWithCategory[]).map(toTransactionDto),
    };
  }

  async spendingTrends(
    userId: string,
    query: DateRangeQueryDto & { granularity?: ReportGranularity },
  ): Promise<SpendingTrends> {
    const { range } = await this.resolveRange(userId, query);
    const granularity = query.granularity ?? pickGranularity(range);
    const rows = await this.dailyAmounts(userId, range);
    return { range, granularity, points: buildTrend(rows, range, granularity) };
  }

  async categoryBreakdown(
    userId: string,
    query: DateRangeQueryDto & { type: TransactionType },
  ): Promise<CategoryBreakdown> {
    const { range } = await this.resolveRange(userId, query);
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: query.type, date: this.dateFilter(range) },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const categories = await this.prisma.category.findMany({
      where: { userId, id: { in: groups.map((g) => g.categoryId) } },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));
    const total = groups.reduce((acc, g) => acc.plus(toDecimal(g._sum.amount)), ZERO);

    const items = groups
      .filter((g) => byId.has(g.categoryId))
      .map((g) => ({
        category: toCategorySummary(byId.get(g.categoryId)!),
        amount: toDecimal(g._sum.amount),
        transactionCount: g._count._all,
      }))
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((item) => ({
        category: item.category,
        total: toMoney(item.amount),
        percentage: percentage(item.amount, total) ?? 0,
        transactionCount: item.transactionCount,
      }));

    return { range, type: query.type, total: toMoney(total), items };
  }

  async transactionReport(
    userId: string,
    query: DateRangeQueryDto & { granularity?: ReportGranularity },
  ): Promise<TransactionReport> {
    const { range } = await this.resolveRange(userId, query);
    const granularity = query.granularity ?? pickGranularity(range);
    const where = { userId, date: this.dateFilter(range) };

    const [totals, rows, largestExpenses, largestIncome] = await Promise.all([
      this.totals(userId, range),
      this.dailyAmounts(userId, range),
      this.prisma.transaction.findMany({
        where: { ...where, type: 'EXPENSE' },
        include: { category: true },
        orderBy: [{ amount: 'desc' }, { date: 'desc' }],
        take: 10,
      }),
      this.prisma.transaction.findMany({
        where: { ...where, type: 'INCOME' },
        include: { category: true },
        orderBy: [{ amount: 'desc' }, { date: 'desc' }],
        take: 5,
      }),
    ]);

    return {
      range,
      granularity,
      totals: {
        income: toMoney(totals.income),
        expenses: toMoney(totals.expenses),
        net: toMoney(totals.net),
        count: totals.count,
      },
      periods: buildTrend(rows, range, granularity),
      largestExpenses: largestExpenses.map(toTransactionDto),
      largestIncome: largestIncome.map(toTransactionDto),
      averageDailyExpense: toMoney(averageDaily(totals.expenses, range)),
    };
  }

  async incomeVsExpenses(
    userId: string,
    query: DateRangeQueryDto & { granularity?: ReportGranularity },
  ): Promise<IncomeExpenseReport> {
    const { range } = await this.resolveRange(userId, query);
    const granularity = query.granularity ?? pickGranularity(range);
    const rows = await this.dailyAmounts(userId, range);
    const totals = calculateTotals(rows);

    let running = ZERO;
    const points = buildTrend(rows, range, granularity).map((p) => {
      running = running.plus(toDecimal(p.net));
      return {
        ...p,
        savingsRate: savingsRate(p.income, p.expenses),
        cumulativeNet: toMoney(running),
      };
    });

    return {
      range,
      granularity,
      points,
      totals: {
        income: toMoney(totals.income),
        expenses: toMoney(totals.expenses),
        net: toMoney(totals.net),
        savingsRate: savingsRate(totals.income, totals.expenses),
      },
    };
  }

  /** CSV of the user's transactions in the range. Fetched in batches to bound memory per query. */
  async exportCsv(
    userId: string,
    query: ExportQueryDto,
  ): Promise<{ filename: string; csv: string }> {
    const { range } = await this.resolveRange(userId, query);
    const where: Prisma.TransactionWhereInput = {
      userId,
      date: this.dateFilter(range),
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    };

    const rows: TransactionWithCategory[] = [];
    let cursor: string | undefined;
    while (rows.length < EXPORT_MAX_ROWS) {
      const batch = await this.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take: EXPORT_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      rows.push(...batch);
      if (batch.length < EXPORT_BATCH) break;
      cursor = batch[batch.length - 1].id;
    }

    const csv = toCsv<TransactionWithCategory>(
      [
        { header: 'Date', value: (t) => fromDbDate(t.date) },
        { header: 'Type', value: (t) => (t.type === 'INCOME' ? 'Income' : 'Expense') },
        { header: 'Title', value: (t) => t.title },
        { header: 'Category', value: (t) => t.category.name },
        { header: 'Amount', value: (t) => toMoney(t.amount), numeric: true },
        {
          header: 'Signed amount',
          value: (t) => (t.type === 'EXPENSE' ? `-${toMoney(t.amount)}` : toMoney(t.amount)),
          numeric: true,
        },
        { header: 'Payment method', value: (t) => PAYMENT_METHOD_LABELS[t.paymentMethod] },
        { header: 'Tags', value: (t) => t.tags.join('; ') },
        { header: 'Notes', value: (t) => t.notes ?? '' },
      ],
      rows.slice(0, EXPORT_MAX_ROWS),
    );
    return { filename: `transactions_${range.from}_to_${range.to}.csv`, csv };
  }
}
