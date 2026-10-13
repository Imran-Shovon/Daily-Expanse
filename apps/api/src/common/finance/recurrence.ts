import type { RecurrenceFrequency } from '@expense/shared';
import { addDays, addMonths, diffCalendarMonths, diffDays, PlainDate } from '../utils/plain-date';

export interface Schedule {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: PlainDate;
  endDate: PlainDate | null;
}

/**
 * The k-th occurrence (k = 0 is the start date). Always computed from the start date so that
 * month-end schedules do not drift: Jan 31 monthly -> Feb 28 -> Mar 31.
 */
export function occurrence(schedule: Schedule, k: number): PlainDate {
  const { frequency, interval, startDate } = schedule;
  switch (frequency) {
    case 'DAILY':
      return addDays(startDate, k * interval);
    case 'WEEKLY':
      return addDays(startDate, k * interval * 7);
    case 'MONTHLY':
      return addMonths(startDate, k * interval);
    case 'YEARLY':
      return addMonths(startDate, k * interval * 12);
  }
}

/** First occurrence on or after `date`, ignoring the end date. */
function firstOnOrAfterUnbounded(schedule: Schedule, date: PlainDate): PlainDate {
  if (date <= schedule.startDate) return schedule.startDate;
  const { frequency, interval } = schedule;
  let k: number;
  switch (frequency) {
    case 'DAILY':
      k = Math.floor(diffDays(schedule.startDate, date) / interval);
      break;
    case 'WEEKLY':
      k = Math.floor(diffDays(schedule.startDate, date) / (interval * 7));
      break;
    case 'MONTHLY':
      k = Math.floor(diffCalendarMonths(schedule.startDate, date) / interval);
      break;
    case 'YEARLY':
      k = Math.floor(diffCalendarMonths(schedule.startDate, date) / (interval * 12));
      break;
  }
  k = Math.max(0, k - 1);
  while (occurrence(schedule, k) < date) k++;
  return occurrence(schedule, k);
}

/** First occurrence on or after `date`, or null if the schedule has ended by then. */
export function firstOccurrenceOnOrAfter(schedule: Schedule, date: PlainDate): PlainDate | null {
  const next = firstOnOrAfterUnbounded(schedule, date);
  if (schedule.endDate && next > schedule.endDate) return null;
  return next;
}

/** Next occurrence strictly after `date`, or null if the schedule has ended. */
export function nextOccurrenceAfter(schedule: Schedule, date: PlainDate): PlainDate | null {
  return firstOccurrenceOnOrAfter(schedule, addDays(date, 1));
}

/**
 * All occurrences from `from` (inclusive) up to `until` (inclusive), capped at `limit`.
 * Used to catch up on runs missed while the scheduler was not running.
 */
export function dueOccurrences(
  schedule: Schedule,
  from: PlainDate,
  until: PlainDate,
  limit = 500,
): PlainDate[] {
  const result: PlainDate[] = [];
  let next = firstOccurrenceOnOrAfter(schedule, from);
  while (next && next <= until && result.length < limit) {
    result.push(next);
    next = nextOccurrenceAfter(schedule, next);
  }
  return result;
}
