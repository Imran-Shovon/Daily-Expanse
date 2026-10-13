'use client';

import type { Budget, Category, TransactionType } from '@expense/shared';
import { PiggyBank, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { BudgetDialog } from '@/components/budgets/budget-dialog';
import { findCategoryBudget } from '@/components/budgets/category-budget-card';
import { CategoryDialog } from '@/components/categories/category-dialog';
import { useFormatters } from '@/components/common/money';
import { CategoryIcon } from '@/components/common/category-icon';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { errorMessage, useBudgets, useCategories, useDeleteCategory } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';

/** Monthly budget summary for an expense category, or a prompt to set one. */
function CategoryBudget({
  budget,
  onSet,
  name,
}: {
  budget: Budget | null;
  onSet: () => void;
  name: string;
}) {
  const { money } = useFormatters();
  if (!budget?.status) {
    return (
      <Button variant="outline" size="sm" onClick={onSet} aria-label={`Set budget for ${name}`}>
        <PiggyBank /> Set budget
      </Button>
    );
  }
  const { status } = budget;
  const over = Number(status.remaining) < 0;
  return (
    <button
      onClick={onSet}
      className="w-36 rounded-lg px-2 py-1 text-left outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-44"
      aria-label={`Edit budget for ${name}`}
    >
      <p className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {money(budget.amount)}/
          {budget.period === 'MONTHLY' ? 'mo' : budget.period === 'WEEKLY' ? 'wk' : 'yr'}
        </span>
        <span
          className={cn(
            'font-medium tabular',
            over
              ? 'text-destructive'
              : status.state === 'warning'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400',
          )}
        >
          {over
            ? `${money(status.remaining.replace('-', ''))} over`
            : `${money(status.remaining)} left`}
        </span>
      </p>
      <Progress
        className="mt-1.5 h-1.5"
        value={status.percentUsed}
        indicatorClassName={
          status.state === 'exceeded'
            ? 'bg-destructive'
            : status.state === 'warning'
              ? 'bg-amber-500'
              : 'bg-primary'
        }
      />
    </button>
  );
}

function CategoryList({
  items,
  budgets,
  onEdit,
  onDelete,
  onBudget,
}: {
  items: Category[];
  budgets?: Budget[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  onBudget: (c: Category, budget: Budget | null) => void;
}) {
  return (
    <ul className="divide-y">
      {items.map((c) => (
        <li key={c.id} className="group flex items-center gap-3 px-5 py-3">
          <CategoryIcon icon={c.icon} color={c.color} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-medium">
              <span className="truncate">{c.name}</span>
              {c.isDefault && (
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  Default
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground tabular">
              {c.transactionCount === 0
                ? 'Not used yet'
                : `${c.transactionCount} transaction${c.transactionCount === 1 ? '' : 's'}`}
            </p>
          </div>
          {c.type === 'EXPENSE' && budgets && (
            <CategoryBudget
              name={c.name}
              budget={findCategoryBudget(budgets, c.id)}
              onSet={() => onBudget(c, findCategoryBudget(budgets, c.id))}
            />
          )}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(c)}
              aria-label={`Edit ${c.name}`}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(c)}
              aria-label={`Delete ${c.name}`}
            >
              <Trash2 />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DeleteCategoryDialog({
  category,
  candidates,
  onOpenChange,
}: {
  category: Category | null;
  candidates: Category[];
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteCategory();
  // Remounted per category (keyed by the parent), so state starts fresh each time.
  const [reassignTo, setReassignTo] = React.useState('');
  const [needsReassign, setNeedsReassign] = React.useState(
    Boolean(category && category.transactionCount > 0),
  );
  const [error, setError] = React.useState<string | null>(null);

  const targets = candidates.filter(
    (c) => category && c.type === category.type && c.id !== category.id,
  );

  return (
    <ConfirmDialog
      open={category !== null}
      onOpenChange={onOpenChange}
      title={`Delete "${category?.name}"?`}
      description={
        needsReassign
          ? 'This category is still in use. Choose where its transactions and recurring schedules should move before deleting it.'
          : 'This category is not used by any transactions. Budgets for it will also be removed.'
      }
      onConfirm={async () => {
        if (!category) return;
        if (needsReassign && !reassignTo) {
          setError('Choose a category to move transactions to.');
          throw new Error('reassign required');
        }
        try {
          await remove.mutateAsync({ id: category.id, reassignTo: reassignTo || undefined });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            setNeedsReassign(true);
            setError(e.message);
          } else {
            toast.error('Could not delete category', { description: errorMessage(e) });
          }
          throw e;
        }
      }}
    >
      {needsReassign && (
        <div className="space-y-1.5">
          <Label htmlFor="reassign">Move transactions to</Label>
          <Select value={reassignTo} onValueChange={setReassignTo}>
            <SelectTrigger id="reassign" aria-invalid={!!error}>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5" />
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}

export function CategoriesView() {
  const query = useCategories();
  const [tab, setTab] = React.useState<TransactionType>('EXPENSE');
  const [dialog, setDialog] = React.useState<{ open: boolean; category?: Category }>({
    open: false,
  });
  const [deleting, setDeleting] = React.useState<Category | null>(null);
  const [budgetDialog, setBudgetDialog] = React.useState<{
    open: boolean;
    budget?: Budget;
    categoryId?: string;
  }>({ open: false });
  const budgets = useBudgets();
  const all = query.data ?? [];

  const panel = (type: TransactionType) => {
    const items = all.filter((c) => c.type === type);
    if (items.length === 0) {
      return (
        <EmptyState
          icon={Tags}
          title={`No ${type === 'EXPENSE' ? 'expense' : 'income'} categories`}
          description="Create one to start organising your transactions."
          action={
            <Button onClick={() => setDialog({ open: true })}>
              <Plus /> New category
            </Button>
          }
        />
      );
    }
    return (
      <CategoryList
        items={items}
        budgets={budgets.data}
        onEdit={(c) => setDialog({ open: true, category: c })}
        onDelete={setDeleting}
        onBudget={(c, budget) =>
          setBudgetDialog({ open: true, budget: budget ?? undefined, categoryId: c.id })
        }
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organise transactions your way. Defaults are created for you and can be changed."
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> New category
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TransactionType)}>
        <TabsList>
          <TabsTrigger value="EXPENSE">
            Expenses{' '}
            <span className="ml-1.5 text-xs text-muted-foreground tabular">
              {all.filter((c) => c.type === 'EXPENSE').length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="INCOME">
            Income{' '}
            <span className="ml-1.5 text-xs text-muted-foreground tabular">
              {all.filter((c) => c.type === 'INCOME').length}
            </span>
          </TabsTrigger>
        </TabsList>
        <Card className="mt-4">
          {query.isLoading ? (
            <LoadingSkeleton variant="list" rows={6} />
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : (
            <>
              <TabsContent value="EXPENSE">{panel('EXPENSE')}</TabsContent>
              <TabsContent value="INCOME">{panel('INCOME')}</TabsContent>
            </>
          )}
        </Card>
      </Tabs>

      <CategoryDialog
        open={dialog.open}
        category={dialog.category}
        defaultType={tab}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <BudgetDialog
        open={budgetDialog.open}
        budget={budgetDialog.budget}
        defaultCategoryId={budgetDialog.categoryId}
        onOpenChange={(open) => setBudgetDialog((d) => ({ ...d, open }))}
      />
      <DeleteCategoryDialog
        key={deleting?.id ?? 'none'}
        category={deleting}
        candidates={all}
        onOpenChange={(o) => !o && setDeleting(null)}
      />
    </div>
  );
}
