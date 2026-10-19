import type { LoanStatus } from '@expense/shared';
import {
  type Decimal,
  type DecimalLike,
  percentage,
  sumMoney,
  toDecimal,
  ZERO,
} from '../common/finance/money';
import type { PlainDate } from '../common/utils/plain-date';

export interface LoanBalance {
  repaid: Decimal;
  outstanding: Decimal;
  percentRepaid: number;
  status: LoanStatus;
}

/** Outstanding balance and status of a loan as of `today` (in the user's time zone). */
export function loanBalance(
  amount: DecimalLike,
  repayments: DecimalLike[],
  dueDate: PlainDate | null,
  today: PlainDate,
): LoanBalance {
  const total = toDecimal(amount);
  const repaid = sumMoney(repayments);
  const outstanding = total.minus(repaid);
  const isPaid = outstanding.lte(0);
  return {
    repaid,
    outstanding: isPaid ? ZERO : outstanding,
    percentRepaid: Math.min(100, percentage(repaid, total) ?? 0),
    status: isPaid ? 'paid' : dueDate && dueDate < today ? 'overdue' : 'active',
  };
}
