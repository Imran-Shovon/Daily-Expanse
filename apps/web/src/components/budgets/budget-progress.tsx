'use client';

import type { BudgetStatus } from '@expense/shared';
import { AlertTriangle, CircleCheck, OctagonAlert } from 'lucide-react';
import { useFormatters } from '@/components/common/money';
import { Progress } from '@/components/ui/misc';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATE = {
  ok: { icon: CircleCheck, label: 'On track', bar: 'bg-primary', text: 'text-muted-foreground' },
  warning: {
    icon: AlertTriangle,
    label: 'Near limit',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  exceeded: {
    icon: OctagonAlert,
    label: 'Over budget',
    bar: 'bg-destructive',
    text: 'text-destructive',
  },
} as const;

/** Progress bar + spent/remaining figures. State is shown with an icon and label, never color alone. */
export function BudgetProgress({
  amount,
  status,
  compact,
  className,
}: {
  amount: string;
  status: BudgetStatus;
  compact?: boolean;
  className?: string;
}) {
  const { money } = useFormatters();
  const meta = STATE[status.state];
  const over = Number(status.remaining) < 0;

  return (
    <div className={cn('space-y-2', className)}>
      <Progress
        value={status.percentUsed}
        indicatorClassName={meta.bar}
        aria-label={`${formatPercent(status.percentUsed)} of budget used`}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground tabular">
          <span className="font-medium text-foreground">{money(status.spent)}</span> of{' '}
          {money(amount)}
        </span>
        <span className={cn('inline-flex items-center gap-1 font-medium', meta.text)}>
          <meta.icon className="size-3.5" aria-hidden />
          {compact
            ? formatPercent(status.percentUsed)
            : over
              ? `${money(status.remaining.replace('-', ''))} over`
              : `${money(status.remaining)} left`}
          {!compact && <span className="sr-only">({meta.label})</span>}
        </span>
      </div>
    </div>
  );
}

export function budgetStateMeta(state: BudgetStatus['state']) {
  return STATE[state];
}
