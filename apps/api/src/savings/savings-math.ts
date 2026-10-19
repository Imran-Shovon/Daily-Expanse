import type { SavingsEntryType } from '@expense/shared';
import { Decimal, type DecimalLike, toDecimal, ZERO } from '../common/finance/money';
import type { PlainDate } from '../common/utils/plain-date';

export interface EntryLike {
  type: SavingsEntryType;
  amount: DecimalLike;
  date: PlainDate;
  /** Breaks ties between entries on the same day. */
  createdAt: Date;
}

const signed = (e: Pick<EntryLike, 'type' | 'amount'>) =>
  e.type === 'DEPOSIT' ? toDecimal(e.amount) : toDecimal(e.amount).negated();

/** Deposits minus withdrawals. */
export function savingsBalance(entries: Pick<EntryLike, 'type' | 'amount'>[]): Decimal {
  return entries.reduce<Decimal>((acc, e) => acc.plus(signed(e)), ZERO);
}

/** Chronological order: by date, then by when the entry was recorded. */
export function chronological<T extends EntryLike>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
