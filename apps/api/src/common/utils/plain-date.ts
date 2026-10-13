/**
 * Calendar-date helpers working on ISO date strings ("2026-10-13").
 *
 * Transactions, budgets and schedules are stored as PostgreSQL DATE values that represent a
 * day in the owning user's time zone. Doing the arithmetic on plain dates (via UTC midnight)
 * keeps results independent of the server's own time zone.
 */
export type PlainDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function isValidPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/** Converts a plain date to the Date value Prisma expects for a DATE column. */
export function toDbDate(date: PlainDate): Date {
  if (!isValidPlainDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

/** Converts a DATE column value (UTC midnight) back to a plain date. */
export function fromDbDate(date: Date): PlainDate {
  return date.toISOString().slice(0, 10);
}

function parts(date: PlainDate): [number, number, number] {
  const d = toDbDate(date);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

function fromParts(year: number, month: number, day: number): PlainDate {
  return fromDbDate(new Date(Date.UTC(year, month, day)));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromDbDate(new Date(toDbDate(date).getTime() + days * DAY_MS));
}

/** Adds months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: PlainDate, months: number): PlainDate {
  const [y, m, d] = parts(date);
  const total = y * 12 + m + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  return fromParts(year, month, Math.min(d, daysInMonth(year, month)));
}

export function addYears(date: PlainDate, years: number): PlainDate {
  return addMonths(date, years * 12);
}

/** Number of days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: PlainDate, to: PlainDate): number {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / DAY_MS);
}

/** Whole calendar months between the month of `from` and the month of `to`. */
export function diffCalendarMonths(from: PlainDate, to: PlainDate): number {
  const [y1, m1] = parts(from);
  const [y2, m2] = parts(to);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** ISO weeks start on Monday. */
export function startOfWeek(date: PlainDate): PlainDate {
  const dow = toDbDate(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function endOfWeek(date: PlainDate): PlainDate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: PlainDate): PlainDate {
  const [y, m] = parts(date);
  return fromParts(y, m, 1);
}

export function endOfMonth(date: PlainDate): PlainDate {
  const [y, m] = parts(date);
  return fromParts(y, m, daysInMonth(y, m));
}

export function startOfYear(date: PlainDate): PlainDate {
  return `${date.slice(0, 4)}-01-01`;
}

export function endOfYear(date: PlainDate): PlainDate {
  return `${date.slice(0, 4)}-12-31`;
}

export function minDate(a: PlainDate, b: PlainDate): PlainDate {
  return a <= b ? a : b;
}

export function maxDate(a: PlainDate, b: PlainDate): PlainDate {
  return a >= b ? a : b;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The current calendar date in the given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): PlainDate {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const map = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatShortDay(date: PlainDate): string {
  const [, m, d] = parts(date);
  return `${MONTH_SHORT[m]} ${d}`;
}

export function formatMonthYear(date: PlainDate): string {
  const [y, m] = parts(date);
  return `${MONTH_SHORT[m]} ${y}`;
}
