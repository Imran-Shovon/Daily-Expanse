import {
  dueOccurrences,
  firstOccurrenceOnOrAfter,
  nextOccurrenceAfter,
  occurrence,
  Schedule,
} from './recurrence';

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  frequency: 'MONTHLY',
  interval: 1,
  startDate: '2026-01-31',
  endDate: null,
  ...overrides,
});

describe('recurrence', () => {
  it('does not drift on month-end schedules', () => {
    const s = schedule({});
    expect([0, 1, 2, 3].map((k) => occurrence(s, k))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('supports intervals for each frequency', () => {
    expect(
      occurrence(schedule({ frequency: 'DAILY', interval: 3, startDate: '2026-10-01' }), 2),
    ).toBe('2026-10-07');
    expect(
      occurrence(schedule({ frequency: 'WEEKLY', interval: 2, startDate: '2026-10-01' }), 1),
    ).toBe('2026-10-15');
    expect(occurrence(schedule({ frequency: 'YEARLY', startDate: '2024-02-29' }), 1)).toBe(
      '2025-02-28',
    );
  });

  it('finds the first occurrence on or after a date', () => {
    const s = schedule({ frequency: 'WEEKLY', startDate: '2026-10-05' });
    expect(firstOccurrenceOnOrAfter(s, '2026-01-01')).toBe('2026-10-05');
    expect(firstOccurrenceOnOrAfter(s, '2026-10-05')).toBe('2026-10-05');
    expect(firstOccurrenceOnOrAfter(s, '2026-10-06')).toBe('2026-10-12');
    expect(nextOccurrenceAfter(s, '2026-10-12')).toBe('2026-10-19');
  });

  it('respects the end date', () => {
    const s = schedule({ frequency: 'DAILY', startDate: '2026-10-01', endDate: '2026-10-03' });
    expect(nextOccurrenceAfter(s, '2026-10-03')).toBeNull();
    expect(dueOccurrences(s, '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('lists catch-up occurrences up to today and caps the batch', () => {
    const s = schedule({ frequency: 'DAILY', startDate: '2026-01-01' });
    expect(dueOccurrences(s, '2026-10-10', '2026-10-13')).toHaveLength(4);
    expect(dueOccurrences(s, '2026-01-01', '2026-12-31', 50)).toHaveLength(50);
    expect(dueOccurrences(s, '2026-10-14', '2026-10-13')).toEqual([]);
  });
});
