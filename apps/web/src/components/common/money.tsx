'use client';

import type { TransactionType } from '@expense/shared';
import { useUser } from '@/lib/auth/auth-provider';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Formats an amount in the user's currency. With `type`, shows a sign and income/expense tone. */
export function Money({
  amount,
  type,
  compact,
  className,
}: {
  amount: string;
  type?: TransactionType;
  compact?: boolean;
  className?: string;
}) {
  const { currency } = useUser();
  const formatted = formatMoney(amount, currency, { compact });
  if (!type) return <span className={cn('tabular', className)}>{formatted}</span>;
  return (
    <span
      className={cn(
        'tabular font-medium',
        type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
        className,
      )}
    >
      {type === 'INCOME' ? '+' : '−'}
      {formatted}
    </span>
  );
}

export function useFormatters() {
  const user = useUser();
  return {
    money: (amount: string | number, opts?: { compact?: boolean; signed?: boolean }) =>
      formatMoney(amount, user.currency, opts),
    currency: user.currency,
    dateFormat: user.dateFormat,
    timezone: user.timezone,
  };
}
