'use client';

import { BUDGET_PERIOD_LABELS, type Budget } from '@expense/shared';
import {
  CalendarClock,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import * as React from 'react';
import { BudgetDialog } from '@/components/budgets/budget-dialog';
import { BudgetProgress, budgetStateMeta } from '@/components/budgets/budget-progress';
import { CategoryIcon } from '@/components/common/category-icon';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useDateFormatter } from '@/components/common/formatted-date';
import { useFormatters } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useBudgets, useDeleteBudget } from '@/lib/api/hooks';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

function BudgetMenu({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const budgetName = (b: Budget) => b.name ?? b.category?.name ?? 'Overall budget';

export function BudgetsView() {
  const query = useBudgets();
  const remove = useDeleteBudget();
  const { money } = useFormatters();
  const fmtDate = useDateFormatter();
  const [dialog, setDialog] = React.useState<{ open: boolean; budget?: Budget }>({ open: false });
  const [deleting, setDeleting] = React.useState<Budget | null>(null);

  const budgets = query.data ?? [];
  const active = budgets.filter((b) => b.status);
  const inactive = budgets.filter((b) => !b.status);
  const overall = active.filter((b) => !b.category);
  const byCategory = active
    .filter((b) => b.category)
    .sort((a, b) => b.status!.percentUsed - a.status!.percentUsed);
  const atRisk = active.filter((b) => b.status!.state !== 'ok').length;

  const edit = (budget: Budget) => setDialog({ open: true, budget });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Set spending limits and see how much room is left in each period."
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> New budget
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-40" />
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState onRetry={() => query.refetch()} />
        </Card>
      ) : budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="No budgets yet"
            description="Create an overall monthly budget, or limits for categories like groceries and eating out. You'll get a warning at 80%."
            action={
              <Button onClick={() => setDialog({ open: true })}>
                <Plus /> Create your first budget
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {overall.map((b) => {
            const meta = budgetStateMeta(b.status!.state);
            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <Target className="size-4 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {budgetName(b)} · {BUDGET_PERIOD_LABELS[b.period]}
                      </p>
                    </div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight tabular">
                      {money(b.status!.spent)}
                      <span className="ml-2 text-base font-normal text-muted-foreground">
                        of {money(b.amount)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(b.status!.periodStart)} – {fmtDate(b.status!.periodEnd)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 md:flex-col md:items-end">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-sm font-medium',
                        meta.text,
                      )}
                    >
                      <meta.icon className="size-4" /> {meta.label}
                    </span>
                    <BudgetMenu
                      label={budgetName(b)}
                      onEdit={() => edit(b)}
                      onDelete={() => setDeleting(b)}
                    />
                  </div>
                </div>
                <div className="border-t bg-muted/20 px-6 py-4">
                  <BudgetProgress amount={b.amount} status={b.status!} />
                </div>
              </Card>
            );
          })}

          {byCategory.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Category budgets</h2>
                {atRisk > 0 && (
                  <Badge variant="warning">
                    {atRisk} need{atRisk === 1 ? 's' : ''} attention
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {byCategory.map((b) => (
                  <Card
                    key={b.id}
                    className={cn('p-5', b.status!.state === 'exceeded' && 'border-destructive/30')}
                  >
                    <div className="flex items-start gap-3">
                      <CategoryIcon icon={b.category!.icon} color={b.category!.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{budgetName(b)}</p>
                        <p className="text-xs text-muted-foreground">
                          {BUDGET_PERIOD_LABELS[b.period]} · {fmtDate(b.status!.periodStart)} –{' '}
                          {fmtDate(b.status!.periodEnd)}
                        </p>
                      </div>
                      <BudgetMenu
                        label={budgetName(b)}
                        onEdit={() => edit(b)}
                        onDelete={() => setDeleting(b)}
                      />
                    </div>
                    <p className="mt-4 mb-2 text-xl font-semibold tracking-tight tabular">
                      {formatPercent(b.status!.percentUsed)}
                    </p>
                    <BudgetProgress amount={b.amount} status={b.status!} />
                  </Card>
                ))}
              </div>
            </section>
          )}

          {inactive.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Not active today</h2>
              <Card className="divide-y">
                {inactive.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{budgetName(b)}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(b.amount)} {BUDGET_PERIOD_LABELS[b.period].toLowerCase()} ·{' '}
                        {fmtDate(b.startDate)}
                        {b.endDate ? ` – ${fmtDate(b.endDate)}` : ' onwards'}
                      </p>
                    </div>
                    <BudgetMenu
                      label={budgetName(b)}
                      onEdit={() => edit(b)}
                      onDelete={() => setDeleting(b)}
                    />
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}

      <BudgetDialog
        open={dialog.open}
        budget={dialog.budget}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this budget?"
        description={
          deleting && (
            <>
              The budget &ldquo;{budgetName(deleting)}&rdquo; will be removed. Your transactions are
              not affected.
            </>
          )
        }
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </div>
  );
}
