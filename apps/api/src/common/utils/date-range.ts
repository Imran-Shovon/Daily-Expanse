import type { DateRange, DateRangePreset, ReportGranularity } from '@expense/shared';
import {
  addMonths,
  diffDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  isValidPlainDate,
  PlainDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './plain-date';

/** Upper bound on custom ranges so a single request cannot scan unbounded history. */
export const MAX_RANGE_DAYS = 366 * 10;

export class DateRangeError extends Error {}

/**
 * Resolves a preset (or a custom from/to pair) into an inclusive calendar date range.
 * `today` must already be expressed in the user's time zone.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  today: PlainDate,
  custom?: { from?: string; to?: string },
): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'this_week':
      return { from: startOfWeek(today), to: endOfWeek(today) };
    case 'this_month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'last_month': {
      const start = addMonths(startOfMonth(today), -1);
      return { from: start, to: endOfMonth(start) };
    }
    case 'this_year':
      return { from: startOfYear(today), to: endOfYear(today) };
    case 'custom': {
      const from = custom?.from;
      const to = custom?.to;
      if (!isValidPlainDate(from) || !isValidPlainDate(to)) {
        throw new DateRangeError(
          'A custom range requires valid "from" and "to" dates (YYYY-MM-DD)',
        );
      }
      if (from > to) throw new DateRangeError('"from" must be on or before "to"');
      if (diffDays(from, to) > MAX_RANGE_DAYS) {
        throw new DateRangeError(`Date ranges are limited to ${MAX_RANGE_DAYS} days`);
      }
      return { from, to };
    }
    default:
      throw new DateRangeError(`Unknown date range "${String(preset)}"`);
  }
}

/** Picks a readable chart granularity for a range length. */
export function pickGranularity(range: DateRange): ReportGranularity {
  const days = diffDays(range.from, range.to) + 1;
  if (days <= 45) return 'day';
  if (days <= 120) return 'week';
  if (days <= 366 * 3) return 'month';
  return 'year';
}
