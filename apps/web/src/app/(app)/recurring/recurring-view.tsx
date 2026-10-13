'use client';

import type { RecurringTransaction } from '@expense/shared';
import {
  CalendarClock,
  ChevronDown,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { CategoryIcon } from '@/components/common/category-icon';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormattedDate } from '@/components/common/formatted-date';
import { Money } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states';
import { describeFrequency, RecurringDialog } from '@/components/recurring/recurring-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge, Skeleton, Switch } from '@/components/ui/misc';
import {
  useDeleteRecurring,
  useRecurring,
  useRecurringExecutions,
  useToggleRecurring,
} from '@/lib/api/hooks';
import { cn } from '@/lib/utils';

function ExecutionHistory({ id }: { id: string }) {
  const query = useRecurringExecutions(id);
  if (query.isLoading) return <Skeleton className="mx-5 mb-4 h-16" />;
  if (!query.data?.length)
    return (
      <p className="px-5 pb-4 text-sm text-muted-foreground">No transactions generated yet.</p>
    );
  return (
    <ul className="mx-5 mb-4 grid gap-1.5 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
      {query.data.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3">
          <FormattedDate date={e.scheduledDate} className="tabular" />
          {e.transactionId ? (
            <Link
              href={`/transactions/${e.transactionId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View transaction
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Transaction deleted</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RecurringRow({
  item,
  onEdit,
  onDelete,
}: {
  item: RecurringTransaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggle = useToggleRecurring();
  const [expanded, setExpanded] = React.useState(false);
  const finished = item.nextRunDate === null;

  return (
    <li className={cn(!item.isActive && 'bg-muted/20')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <CategoryIcon icon={item.category.icon} color={item.category.color} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{item.title}</span>
            {finished ? (
              <Badge variant="secondary">Finished</Badge>
            ) : !item.isActive ? (
              <Badge variant="outline">Paused</Badge>
            ) : null}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <Repeat className="size-3" aria-hidden />
            {describeFrequency(item.frequency, item.interval)} · {item.category.name}
            {item.endDate && (
              <>
                {' '}
                · until <FormattedDate date={item.endDate} />
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <Money amount={item.amount} type={item.type} />
          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3" aria-hidden />
            {finished ? (
              'No upcoming runs'
            ) : item.isActive ? (
              <>
                Next <FormattedDate date={item.nextRunDate!} />
              </>
            ) : (
              'Paused'
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={item.isActive}
            disabled={toggle.isPending || finished}
            onCheckedChange={(active) => toggle.mutate({ id: item.id, active })}
            aria-label={item.isActive ? `Pause ${item.title}` : `Resume ${item.title}`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setExpanded((e) => !e)}>
                <History /> {expanded ? 'Hide history' : 'Show history'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1 px-5 pb-3 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
      >
        <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
        {item.executionCount} generated
        {item.lastRunDate && (
          <>
            {' '}
            · last on <FormattedDate date={item.lastRunDate} />
          </>
        )}
      </button>
      {expanded && <ExecutionHistory id={item.id} />}
    </li>
  );
}

export function RecurringView() {
  const query = useRecurring();
  const remove = useDeleteRecurring();
  const [dialog, setDialog] = React.useState<{ open: boolean; item?: RecurringTransaction }>({
    open: false,
  });
  const [deleting, setDeleting] = React.useState<RecurringTransaction | null>(null);
  const items = query.data ?? [];
  const activeCount = items.filter((i) => i.isActive && i.nextRunDate).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring transactions"
        description={
          items.length > 0
            ? `${activeCount} active schedule${activeCount === 1 ? '' : 's'}. Due transactions are created automatically.`
            : 'Automate rent, salary, subscriptions and other repeating items.'
        }
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> New schedule
          </Button>
        }
      />

      <Card>
        {query.isLoading ? (
          <LoadingSkeleton variant="list" rows={4} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No recurring transactions"
            description="Set up a schedule once and we will add the transaction for you every day, week, month or year."
            action={
              <Button onClick={() => setDialog({ open: true })}>
                <Plus /> Create a schedule
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <RecurringRow
                key={item.id}
                item={item}
                onEdit={() => setDialog({ open: true, item })}
                onDelete={() => setDeleting(item)}
              />
            ))}
          </ul>
        )}
      </Card>

      <RecurringDialog
        open={dialog.open}
        item={dialog.item}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this schedule?"
        description="No more transactions will be created. Transactions it already generated are kept."
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </div>
  );
}
