import {
  addDays,
  addMonths,
  diffDays,
  endOfMonth,
  endOfWeek,
  fromDbDate,
  isValidPlainDate,
  isValidTimeZone,
  startOfWeek,
  toDbDate,
  todayInTimeZone,
} from './plain-date';

describe('plain-date', () => {
  it('validates ISO calendar dates', () => {
    expect(isValidPlainDate('2026-02-28')).toBe(true);
    expect(isValidPlainDate('2024-02-29')).toBe(true);
    expect(isValidPlainDate('2026-02-29')).toBe(false);
    expect(isValidPlainDate('2026-13-01')).toBe(false);
    expect(isValidPlainDate('2026-1-01')).toBe(false);
    expect(isValidPlainDate('2026-01-01T00:00:00Z')).toBe(false);
    expect(isValidPlainDate(20260101)).toBe(false);
  });

  it('round-trips through the database representation', () => {
    expect(toDbDate('2026-10-13').toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(fromDbDate(toDbDate('2026-10-13'))).toBe('2026-10-13');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps month arithmetic to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('uses Monday-based weeks', () => {
    // 2026-10-13 is a Tuesday
    expect(startOfWeek('2026-10-13')).toBe('2026-10-12');
    expect(endOfWeek('2026-10-13')).toBe('2026-10-18');
    // Sunday belongs to the week that started the previous Monday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
  });

  it('computes month ends and day differences', () => {
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('resolves "today" in the user time zone', () => {
    const instant = new Date('2026-10-13T22:30:00Z');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-10-13');
    expect(todayInTimeZone('Asia/Dhaka', instant)).toBe('2026-10-14'); // UTC+6
    expect(todayInTimeZone('America/Los_Angeles', instant)).toBe('2026-10-13');
    expect(todayInTimeZone('Not/AZone', instant)).toBe('2026-10-13'); // falls back to UTC
  });

  it('validates IANA time zones', () => {
    expect(isValidTimeZone('Asia/Dhaka')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
