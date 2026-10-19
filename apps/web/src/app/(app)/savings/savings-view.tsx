'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { SavingsEntry, SavingsEntryType } from '@expense/shared';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  History,
  Trash2,
  Vault,
} from 'lucide-react';
import * as React from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useDateFormatter } from '@/components/common/formatted-date';
import { useFormatters } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states';
import { SavingsEntryDialog } from '@/components/savings/savings-entry-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { useDeleteSavingsEntry, useSavingsHistory, useSavingsSummary } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const FILTERS: { value: SavingsEntryType | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'DEPOSIT', label: 'Added' },
  { value: 'WITHDRAWAL', label: 'Taken out' },
];

function StatCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {children}
    </Card>
  );
}

function FlowLine({ added, takenOut }: { added: string; takenOut: string }) {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  return (
    <dl className="mt-2 space-y-1 text-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowDownToLine className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          {tr('Added')}
        </dt>
        <dd className="font-medium tabular text-emerald-700 dark:text-emerald-400">
          +{money(added)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowUpFromLine className="size-3.5" />
          {tr('Taken out')}
        </dt>
        <dd className="font-medium tabular">−{money(takenOut)}</dd>
      </div>
    </dl>
  );
}

function HistoryRow({ entry, onRemove }: { entry: SavingsEntry; onRemove: () => void }) {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  const fmtDate = useDateFormatter();
  const deposit = entry.type === 'DEPOSIT';
  const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine;
  // Older entries were recorded before source and purpose existed.
  const detail = deposit ? entry.source : entry.purpose;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          deposit
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {detail
            ? tr(detail)
            : entry.notes || (deposit ? tr('Added to savings') : tr('Taken out of savings'))}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {fmtDate(entry.date)} · {deposit ? tr('Source of funds') : tr('Purpose')}
          {detail && entry.notes && ` · ${entry.notes}`}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular',
            deposit && 'text-emerald-700 dark:text-emerald-400',
          )}
        >
          {deposit ? '+' : '−'}
          {money(entry.amount)}
        </p>
        <p className="text-xs text-muted-foreground tabular">
          {tr('Balance {v0}', { v0: money(entry.balanceAfter) })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={tr('Remove entry of {v0}', { v0: money(entry.amount) })}
        onClick={onRemove}
      >
        <Trash2 className="text-muted-foreground" />
      </Button>
    </li>
  );
}

export function SavingsView() {
  const { t: tr, number } = useLanguage();
  const { money } = useFormatters();
  const summary = useSavingsSummary();
  const [filter, setFilter] = React.useState<SavingsEntryType | undefined>(undefined);
  const [page, setPage] = React.useState(1);
  const historyQuery = useSavingsHistory({ page, pageSize: PAGE_SIZE, type: filter });
  const remove = useDeleteSavingsEntry();
  const [dialog, setDialog] = React.useState<SavingsEntryType | null>(null);
  const [removing, setRemoving] = React.useState<SavingsEntry | null>(null);

  const s = summary.data;
  const balance = s?.balance ?? '0.00';
  // Both actions wait for the balance so the dialog never shows a made-up amount.
  const hasSavings = !!s && Number(balance) > 0;
  const meta = historyQuery.data?.meta;

  const chooseFilter = (value: SavingsEntryType | undefined) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('Savings')}
        description={tr(
          'Add money when you save it, take it out when you need it. Every move is kept in your history.',
        )}
        actions={
          <>
            <Button
              variant="outline"
              disabled={!hasSavings}
              onClick={() => setDialog('WITHDRAWAL')}
            >
              <ArrowUpFromLine /> {tr('Take out')}
            </Button>
            <Button disabled={!s} onClick={() => setDialog('DEPOSIT')}>
              <ArrowDownToLine /> {tr('Add money')}
            </Button>
          </>
        }
      />

      {summary.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
            </Card>
          ))}
        </div>
      ) : summary.isError || !s ? (
        <Card>
          <ErrorState onRetry={() => summary.refetch()} />
        </Card>
      ) : s.entryCount === 0 ? (
        <Card>
          <EmptyState
            icon={Vault}
            title={tr('Nothing saved yet')}
            description={tr(
              'Add money whenever you put some aside. Take it out when you need it, and the balance updates automatically.',
            )}
            action={
              <Button onClick={() => setDialog('DEPOSIT')}>
                <ArrowDownToLine /> {tr('Add your first savings')}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={tr('Savings balance')} className="border-primary/30 bg-accent/40">
              <p className="mt-2 text-3xl font-semibold tracking-tight text-accent-foreground tabular">
                {money(s.balance)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {s.entryCount === 1
                  ? tr('1 entry')
                  : tr('{count} entries', { count: s.entryCount })}
              </p>
            </StatCard>
            <StatCard label={tr('This month')}>
              <FlowLine added={s.thisMonth.added} takenOut={s.thisMonth.takenOut} />
            </StatCard>
            <StatCard label={tr('All time')}>
              <FlowLine added={s.totalAdded} takenOut={s.totalTakenOut} />
            </StatCard>
          </div>

          <Card>
            <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
              <CardTitle className="inline-flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                {tr('History')}
              </CardTitle>
              <div
                role="radiogroup"
                aria-label={tr('Filter history')}
                className="inline-flex gap-1 rounded-lg bg-muted p-1"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    role="radio"
                    aria-checked={filter === f.value}
                    onClick={() => chooseFilter(f.value)}
                    className={cn(
                      'h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      filter === f.value && 'bg-card text-foreground shadow-xs',
                    )}
                  >
                    {tr(f.label)}
                  </button>
                ))}
              </div>
            </CardHeader>

            {historyQuery.isLoading ? (
              <LoadingSkeleton variant="list" rows={5} />
            ) : historyQuery.isError ? (
              <ErrorState onRetry={() => historyQuery.refetch()} />
            ) : historyQuery.data?.data.length === 0 ? (
              <EmptyState
                icon={History}
                title={
                  filter === 'DEPOSIT' ? tr('No money added yet') : tr('No money taken out yet')
                }
                className="py-10"
              />
            ) : (
              <ul
                className={cn(
                  'divide-y border-t transition-opacity',
                  historyQuery.isPlaceholderData && 'opacity-60',
                )}
              >
                {historyQuery.data?.data.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} onRemove={() => setRemoving(entry)} />
                ))}
              </ul>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t px-5 py-3 text-sm sm:flex-row">
                <p className="text-muted-foreground">
                  {tr('Showing')}{' '}
                  <span className="font-medium text-foreground tabular">
                    {number((meta.page - 1) * meta.pageSize + 1)}–
                    {number(Math.min(meta.page * meta.pageSize, meta.total))}
                  </span>{' '}
                  {tr('of')}{' '}
                  <span className="font-medium text-foreground tabular">{number(meta.total)}</span>
                </p>
                <nav className="flex items-center gap-2" aria-label={tr('Pagination')}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft /> {tr('Previous')}
                  </Button>
                  <span className="px-1 text-muted-foreground tabular">
                    {number(meta.page)} / {number(meta.totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= meta.totalPages}
                  >
                    {tr('Next')} <ChevronRight />
                  </Button>
                </nav>
              </div>
            )}
          </Card>
        </>
      )}

      <SavingsEntryDialog
        type={dialog}
        balance={balance}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={tr('Remove this entry?')}
        confirmLabel="Remove"
        description={
          removing &&
          (removing.type === 'DEPOSIT'
            ? tr('{v0} will be taken off your savings balance.', { v0: money(removing.amount) })
            : tr('{v0} will be added back to your savings balance.', {
                v0: money(removing.amount),
              }))
        }
        onConfirm={async () => {
          await remove.mutateAsync(removing!.id);
          // Removing the last row of a later page would otherwise leave the page empty.
          if (page > 1 && historyQuery.data?.data.length === 1) setPage((p) => p - 1);
        }}
      />
    </div>
  );
}
