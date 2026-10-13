import {
  BUDGET_EXCEEDED_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  type BudgetPeriod,
  type BudgetState,
  type DateRange,
  type ReportGranularity,
  type TransactionType,
  type TrendPoint,
} from '@expense/shared';
import {
  addDays,
  addMonths,
  diffCalendarMonths,
  diffDays,
  formatMonthYear,
  formatShortDay,
  maxDate,
  minDate,
  PlainDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '../utils/plain-date';
import { Decimal, DecimalLike, percentage, toDecimal, toMoney, ZERO } from './money';

export interface TypedAmount {
  type: TransactionType;
  amount: DecimalLike;
}

export interface Totals {
  income: Decimal;
  expenses: Decimal;
  /** income - expenses */
  net: Decimal;
}

/** Income only counts INCOME rows, expenses only count EXPENSE rows. */
export function calculateTotals(rows: TypedAmount[]): Totals {
  let income = ZERO;
  let expenses = ZERO;
  for (const row of rows) {
    if (row.type === 'INCOME') income = income.plus(toDecimal(row.amount));
    else if (row.type === 'EXPENSE') expenses = expenses.plus(toDecimal(row.amount));
  }
  return { income, expenses, net: income.minus(expenses) };
}

/** (income - expenses) / income * 100 when income > 0, otherwise null. */
export function savingsRate(income: DecimalLike, expenses: DecimalLike): number | null {
  const inc = toDecimal(income);
  if (inc.lte(0)) return null;
  return percentage(inc.minus(toDecimal(expenses)), inc);
}

export function budgetState(percentUsed: number): BudgetState {
  if (percentUsed > BUDGET_EXCEEDED_THRESHOLD) return 'exceeded';
  if (percentUsed >= BUDGET_WARNING_THRESHOLD) return 'warning';
  return 'ok';
}

export interface BudgetUsage {
  spent: Decimal;
  remaining: Decimal;
  percentUsed: number;
  state: BudgetState;
}

/**
 * Utilization = qualifying expenses / budget amount * 100.
 * `remaining` may be negative when the budget is exceeded.
 */
export function calculateBudgetUsage(amount: DecimalLike, spent: DecimalLike): BudgetUsage {
  const budget = toDecimal(amount);
  const used = toDecimal(spent);
  const pct = percentage(used, budget);
  // A zero budget cannot be divided by; any spending against it counts as exceeded.
  if (pct === null) {
    return {
      spent: used,
      remaining: budget.minus(used),
      percentUsed: used.gt(0) ? 100 : 0,
      state: used.gt(0) ? 'exceeded' : 'ok',
    };
  }
  return { spent: used, remaining: budget.minus(used), percentUsed: pct, state: budgetState(pct) };
}

/**
 * Finds the budget period instance that contains `reference`. Periods are anchored at the
 * budget's start date: a monthly budget starting on the 15th runs 15th–14th.
 * Returns null when the budget is not active on that date.
 */
export function budgetPeriodFor(
  budget: { period: BudgetPeriod; startDate: PlainDate; endDate: PlainDate | null },
  reference: PlainDate,
): DateRange | null {
  const { period, startDate, endDate } = budget;
  if (reference < startDate) return null;
  if (endDate && reference > endDate) return null;

  let from: PlainDate;
  let next: PlainDate;
  if (period === 'WEEKLY') {
    const k = Math.floor(diffDays(startDate, reference) / 7);
    from = addDays(startDate, k * 7);
    next = addDays(from, 7);
  } else {
    const step = period === 'YEARLY' ? 12 : 1;
    let k = Math.floor(diffCalendarMonths(startDate, reference) / step);
    // Month clamping can push the anchored start past the reference; step back if so.
    while (k > 0 && addMonths(startDate, k * step) > reference) k--;
    while (addMonths(startDate, (k + 1) * step) <= reference) k++;
    from = addMonths(startDate, k * step);
    next = addMonths(startDate, (k + 1) * step);
  }
  const to = addDays(next, -1);
  return { from, to: endDate ? minDate(to, endDate) : to };
}

/** Start date of the bucket a date falls into. */
export function bucketStart(date: PlainDate, granularity: ReportGranularity): PlainDate {
  switch (granularity) {
    case 'day':
      return date;
    case 'week':
      return startOfWeek(date);
    case 'month':
      return startOfMonth(date);
    case 'year':
      return startOfYear(date);
  }
}

function nextBucket(start: PlainDate, granularity: ReportGranularity): PlainDate {
  switch (granularity) {
    case 'day':
      return addDays(start, 1);
    case 'week':
      return addDays(start, 7);
    case 'month':
      return addMonths(start, 1);
    case 'year':
      return addMonths(start, 12);
  }
}

export function bucketLabel(start: PlainDate, granularity: ReportGranularity): string {
  switch (granularity) {
    case 'day':
      return formatShortDay(start);
    case 'week':
      return `Wk ${formatShortDay(start)}`;
    case 'month':
      return formatMonthYear(start);
    case 'year':
      return start.slice(0, 4);
  }
}

export interface DailyAmount {
  date: PlainDate;
  type: TransactionType;
  amount: DecimalLike;
}

/**
 * Groups per-day sums into buckets covering the whole range, including empty buckets so
 * charts have a continuous axis. Each input row is counted exactly once.
 */
export function buildTrend(
  rows: DailyAmount[],
  range: DateRange,
  granularity: ReportGranularity,
): TrendPoint[] {
  const buckets = new Map<PlainDate, { income: Decimal; expenses: Decimal }>();
  for (
    let cursor = bucketStart(range.from, granularity);
    cursor <= range.to;
    cursor = nextBucket(cursor, granularity)
  ) {
    buckets.set(cursor, { income: ZERO, expenses: ZERO });
  }

  for (const row of rows) {
    if (row.date < range.from || row.date > range.to) continue;
    const bucket = buckets.get(bucketStart(row.date, granularity));
    if (!bucket) continue;
    if (row.type === 'INCOME') bucket.income = bucket.income.plus(toDecimal(row.amount));
    else bucket.expenses = bucket.expenses.plus(toDecimal(row.amount));
  }

  return [...buckets.entries()].map(([start, { income, expenses }]) => ({
    date: maxDate(start, range.from),
    label: bucketLabel(start, granularity),
    income: toMoney(income),
    expenses: toMoney(expenses),
    net: toMoney(income.minus(expenses)),
  }));
}

/** Average expense per calendar day in the range. */
export function averageDaily(total: DecimalLike, range: DateRange): Decimal {
  const days = diffDays(range.from, range.to) + 1;
  return toDecimal(total).div(days);
}
