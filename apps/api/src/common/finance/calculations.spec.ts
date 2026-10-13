import {
  averageDaily,
  budgetPeriodFor,
  budgetState,
  buildTrend,
  calculateBudgetUsage,
  calculateTotals,
  savingsRate,
} from './calculations';
import { percentage, sumMoney, toMoney } from './money';

describe('money helpers', () => {
  it('avoids floating point error', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE floating point
    expect(toMoney(sumMoney(['0.10', '0.20']))).toBe('0.30');
    expect(toMoney(sumMoney(Array(10).fill('0.10')))).toBe('1.00');
  });

  it('rounds half up to two decimals', () => {
    expect(toMoney('2.345')).toBe('2.35');
    expect(toMoney(null)).toBe('0.00');
  });

  it('never divides by zero', () => {
    expect(percentage('10', '0')).toBeNull();
    expect(percentage('10', '-5')).toBeNull();
    expect(percentage('1', '3')).toBe(33.3);
  });
});

describe('calculateTotals', () => {
  it('separates income from expenses', () => {
    const totals = calculateTotals([
      { type: 'INCOME', amount: '3000.00' },
      { type: 'EXPENSE', amount: '120.45' },
      { type: 'EXPENSE', amount: '79.55' },
      { type: 'INCOME', amount: '500.10' },
    ]);
    expect(toMoney(totals.income)).toBe('3500.10');
    expect(toMoney(totals.expenses)).toBe('200.00');
    expect(toMoney(totals.net)).toBe('3300.10');
  });

  it('returns zeros for no transactions', () => {
    const totals = calculateTotals([]);
    expect(toMoney(totals.net)).toBe('0.00');
  });

  it('produces a negative net when spending exceeds income', () => {
    const totals = calculateTotals([
      { type: 'INCOME', amount: '100' },
      { type: 'EXPENSE', amount: '150.50' },
    ]);
    expect(toMoney(totals.net)).toBe('-50.50');
  });
});

describe('savingsRate', () => {
  it('is net savings over income as a percentage', () => {
    expect(savingsRate('4000', '3000')).toBe(25);
    expect(savingsRate('3000', '4500')).toBe(-50);
  });

  it('is null when there is no income', () => {
    expect(savingsRate('0', '100')).toBeNull();
    expect(savingsRate(null, null)).toBeNull();
  });
});

describe('budgets', () => {
  it('classifies thresholds at 80% and over 100%', () => {
    expect(budgetState(79.9)).toBe('ok');
    expect(budgetState(80)).toBe('warning');
    expect(budgetState(100)).toBe('warning');
    expect(budgetState(100.1)).toBe('exceeded');
  });

  it('calculates usage from spent amount', () => {
    const usage = calculateBudgetUsage('500.00', '410.00');
    expect(usage.percentUsed).toBe(82);
    expect(usage.state).toBe('warning');
    expect(toMoney(usage.remaining)).toBe('90.00');
  });

  it('reports negative remaining when exceeded', () => {
    const usage = calculateBudgetUsage('200', '250.75');
    expect(usage.state).toBe('exceeded');
    expect(toMoney(usage.remaining)).toBe('-50.75');
    expect(usage.percentUsed).toBe(125.4);
  });

  it('handles a zero budget without dividing by zero', () => {
    expect(calculateBudgetUsage('0', '0')).toMatchObject({ percentUsed: 0, state: 'ok' });
    expect(calculateBudgetUsage('0', '5')).toMatchObject({ percentUsed: 100, state: 'exceeded' });
  });

  describe('budgetPeriodFor', () => {
    const monthly = { period: 'MONTHLY' as const, startDate: '2026-01-01', endDate: null };

    it('finds calendar-month periods for budgets starting on the 1st', () => {
      expect(budgetPeriodFor(monthly, '2026-10-13')).toEqual({
        from: '2026-10-01',
        to: '2026-10-31',
      });
      expect(budgetPeriodFor(monthly, '2026-02-28')).toEqual({
        from: '2026-02-01',
        to: '2026-02-28',
      });
    });

    it('anchors periods to a mid-month start date', () => {
      const b = { period: 'MONTHLY' as const, startDate: '2026-01-15', endDate: null };
      expect(budgetPeriodFor(b, '2026-10-13')).toEqual({ from: '2026-09-15', to: '2026-10-14' });
      expect(budgetPeriodFor(b, '2026-10-15')).toEqual({ from: '2026-10-15', to: '2026-11-14' });
    });

    it('handles month-end anchors', () => {
      const b = { period: 'MONTHLY' as const, startDate: '2026-01-31', endDate: null };
      expect(budgetPeriodFor(b, '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-03-30' });
    });

    it('supports weekly and yearly periods', () => {
      const weekly = { period: 'WEEKLY' as const, startDate: '2026-10-05', endDate: null };
      expect(budgetPeriodFor(weekly, '2026-10-13')).toEqual({
        from: '2026-10-12',
        to: '2026-10-18',
      });
      const yearly = { period: 'YEARLY' as const, startDate: '2025-04-01', endDate: null };
      expect(budgetPeriodFor(yearly, '2026-10-13')).toEqual({
        from: '2026-04-01',
        to: '2027-03-31',
      });
    });

    it('returns null outside the active window and clips to the end date', () => {
      expect(budgetPeriodFor(monthly, '2025-12-31')).toBeNull();
      const ending = { period: 'MONTHLY' as const, startDate: '2026-01-01', endDate: '2026-10-20' };
      expect(budgetPeriodFor(ending, '2026-10-21')).toBeNull();
      expect(budgetPeriodFor(ending, '2026-10-05')).toEqual({
        from: '2026-10-01',
        to: '2026-10-20',
      });
    });
  });
});

describe('buildTrend', () => {
  const rows = [
    { date: '2026-10-01', type: 'EXPENSE' as const, amount: '10.10' },
    { date: '2026-10-01', type: 'INCOME' as const, amount: '100.00' },
    { date: '2026-10-03', type: 'EXPENSE' as const, amount: '5.05' },
    { date: '2026-11-01', type: 'EXPENSE' as const, amount: '999' }, // outside range
  ];

  it('fills empty days and never double counts', () => {
    const points = buildTrend(rows, { from: '2026-10-01', to: '2026-10-03' }, 'day');
    expect(points.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(points[0]).toMatchObject({ income: '100.00', expenses: '10.10', net: '89.90' });
    expect(points[1]).toMatchObject({ income: '0.00', expenses: '0.00' });
    expect(points[2]).toMatchObject({ expenses: '5.05', net: '-5.05' });
  });

  it('groups into weeks and months', () => {
    const weekly = buildTrend(rows, { from: '2026-10-01', to: '2026-10-11' }, 'week');
    // Oct 1 2026 is a Thursday; first bucket starts on the range start
    expect(weekly.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-05']);
    expect(weekly[0].expenses).toBe('15.15');

    const monthly = buildTrend(rows, { from: '2026-10-01', to: '2026-11-30' }, 'month');
    expect(monthly).toHaveLength(2);
    expect(monthly[1]).toMatchObject({ label: 'Nov 2026', expenses: '999.00' });
  });
});

describe('averageDaily', () => {
  it('divides by the number of calendar days in the range', () => {
    expect(toMoney(averageDaily('310', { from: '2026-10-01', to: '2026-10-31' }))).toBe('10.00');
  });
});
