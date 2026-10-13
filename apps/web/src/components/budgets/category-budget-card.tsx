'use client';

import type { Budget, CategorySummary } from '@expense/shared';
import { AlertTriangle, OctagonAlert, PiggyBank, Plus } from 'lucide-react';
import * as React from 'react';
import { useFormatters } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { Progress, Skeleton } from '@/components/ui/misc';
import { useBudgets } from '@/lib/api/hooks';
import { formatPercent, isValidAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BudgetDialog } from './budget-dialog';

/** Integer cents for display-only previews; the server does the authoritative decimal math. */
const toCents = (value: string) => Math.round(Number(value) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/** The active budget for a category on a date, preferring monthly budgets. */
export function findCategoryBudget(budgets: Budget[] | undefined, categoryId: string) {
  const active = (budgets ?? []).filter((b) => b.category?.id === categoryId && b.status);
  return active.find((b) => b.period === 'MONTHLY') ?? active[0] ?? null;
}

/**
 * Shown while adding or editing an expense: the category's budget for the period containing
 * the chosen date, what is already spent, what is available, and what will be left after
 * this expense.
 */
export function CategoryBudgetCard({
  category,
  date,
  amount,
  original,
}: {
  category: CategorySummary;
  date: string;
  amount: string;
  /** When editing: the saved expense, already counted in "spent". */
  original?: { categoryId: string; date: string; amount: string; type: string };
}) {
  const { money } = useFormatters();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const budgets = useBudgets(validDate);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const budget = findCategoryBudget(budgets.data, category.id);

  if (budgets.isLoading) {
    return <Skeleton className="h-[92px] rounded-xl" />;
  }

  if (!budget?.status) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/30 p-4 sm:flex-row sm:items-center">
        <PiggyBank className="size-5 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm text-muted-foreground">
          No monthly budget for <span className="font-medium text-foreground">{category.name}</span>{' '}
          yet. Set one to see how much you have left.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus /> Set monthly budget
        </Button>
        <BudgetDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultCategoryId={category.id}
        />
      </div>
    );
  }

  const status = budget.status;
  const limit = toCents(budget.amount);
  let spent = toCents(status.spent);
  // When editing, the saved amount is already in "spent"; don't count it twice.
  if (
    original &&
    original.type === 'EXPENSE' &&
    original.categoryId === category.id &&
    original.date >= status.periodStart &&
    original.date <= status.periodEnd
  ) {
    spent -= toCents(original.amount);
  }
  const available = limit - spent;
  const thisExpense = isValidAmount(amount) ? toCents(amount) : 0;
  const after = available - thisExpense;
  const afterPercent = limit > 0 ? ((spent + thisExpense) / limit) * 100 : 100;
  const state = afterPercent > 100 ? 'exceeded' : afterPercent >= 80 ? 'warning' : 'ok';

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        state === 'exceeded'
          ? 'border-destructive/30 bg-destructive/5'
          : state === 'warning'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'bg-muted/30',
      )}
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {category.name} · {budget.period === 'MONTHLY' ? 'monthly' : budget.period.toLowerCase()}{' '}
          budget
        </p>
        <p className="text-sm text-muted-foreground tabular">{money(budget.amount)}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-card px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Spent</p>
          <p className="text-sm font-semibold tabular">{money(fromCents(spent))}</p>
        </div>
        <div className="rounded-lg bg-card px-2 py-2">
          <p className="text-[11px] text-muted-foreground">Available</p>
          <p
            className={cn(
              'text-sm font-semibold tabular',
              available < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400',
            )}
          >
            {money(fromCents(available))}
          </p>
        </div>
        <div className="rounded-lg bg-card px-2 py-2">
          <p className="text-[11px] text-muted-foreground">After this</p>
          <p className={cn('text-sm font-semibold tabular', after < 0 && 'text-destructive')}>
            {thisExpense ? money(fromCents(after)) : '—'}
          </p>
        </div>
      </div>

      <Progress
        className="mt-3"
        value={Math.min(100, afterPercent)}
        indicatorClassName={
          state === 'exceeded'
            ? 'bg-destructive'
            : state === 'warning'
              ? 'bg-amber-500'
              : 'bg-primary'
        }
        aria-label={`${formatPercent(afterPercent)} of budget used including this expense`}
      />

      {state !== 'ok' && thisExpense > 0 && (
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs font-medium',
            state === 'exceeded' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400',
          )}
        >
          {state === 'exceeded' ? (
            <OctagonAlert className="size-3.5" />
          ) : (
            <AlertTriangle className="size-3.5" />
          )}
          {state === 'exceeded'
            ? `This expense puts you ${money(fromCents(-after))} over budget.`
            : `You will have used ${formatPercent(afterPercent)} of this budget.`}
        </p>
      )}
    </div>
  );
}
