'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Loan, LoanDirection, LoanRepayment, LoanStatus } from '@expense/shared';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  HandCoins,
  HandHeart,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import * as React from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useDateFormatter } from '@/components/common/formatted-date';
import { useFormatters } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState } from '@/components/common/states';
import { LOAN_COPY } from '@/components/loans/loan-copy';
import { LoanDialog } from '@/components/loans/loan-dialog';
import { RepayDialog } from '@/components/loans/repay-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';
import { useDeleteLoan, useDeleteRepayment, useLoans } from '@/lib/api/hooks';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<LoanStatus, 'default' | 'destructive' | 'secondary'> = {
  active: 'default',
  overdue: 'destructive',
  paid: 'secondary',
};

const DIRECTION_ICON = { BORROWED: HandCoins, LENT: HandHeart } as const;

function SummaryTile({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Card className={cn('p-5', emphasis && 'border-primary/30 bg-accent/40')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight tabular',
          emphasis && 'text-accent-foreground',
        )}
      >
        {value}
      </p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function LoanCard({
  loan,
  onRepay,
  onEdit,
  onDelete,
  onUndoRepayment,
}: {
  loan: Loan;
  onRepay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUndoRepayment: (repayment: LoanRepayment) => void;
}) {
  const { t: tr, locale } = useLanguage();
  const { money } = useFormatters();
  const fmtDate = useDateFormatter();
  const [showHistory, setShowHistory] = React.useState(false);
  const copy = LOAN_COPY[loan.direction];
  const Icon = DIRECTION_ICON[loan.direction];
  const isPaid = loan.status === 'paid';
  const historyId = `loan-history-${loan.id}`;

  return (
    <Card className={cn('flex flex-col', loan.status === 'overdue' && 'border-destructive/30')}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              isPaid ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground',
            )}
          >
            {isPaid ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="min-w-0 truncate font-medium">{loan.counterparty}</p>
              <Badge variant={STATUS_VARIANT[loan.status]} className="shrink-0">
                {loan.status === 'overdue' && <AlertTriangle />}
                {tr(copy.status[loan.status])}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tr(copy.cardDate, { v0: fmtDate(loan.loanDate) })}
              {loan.dueDate && (
                <>
                  {' · '}
                  <span className={cn(loan.status === 'overdue' && 'font-medium text-destructive')}>
                    {tr('Due {v0}', { v0: fmtDate(loan.dueDate) })}
                  </span>
                </>
              )}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={tr('Actions for {v0}', { v0: loan.counterparty })}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {tr('Edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 /> {tr('Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {isPaid ? tr(copy.settledInFull) : tr(copy.outstanding)}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular">
              {money(isPaid ? loan.amount : loan.outstanding)}
            </p>
          </div>
          {!isPaid && (
            <Button size="sm" onClick={onRepay}>
              <Undo2 /> {tr(copy.action)}
            </Button>
          )}
        </div>

        <Progress
          className="mt-4"
          value={loan.percentRepaid}
          indicatorClassName={cn(isPaid && 'bg-muted-foreground/50')}
          aria-label={tr(copy.progressLabel)}
        />
        <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground tabular">
          <span>
            {tr(copy.progress, { v0: money(loan.repaid) })} ·{' '}
            {formatPercent(loan.percentRepaid, undefined, locale)}
          </span>
          <span>{tr('of {v0}', { v0: money(loan.amount) })}</span>
        </div>
        {loan.notes && <p className="mt-3 text-sm text-muted-foreground">{loan.notes}</p>}
      </div>

      {loan.repayments.length > 0 && (
        <div className="mt-auto border-t">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium hover:bg-muted/40"
            aria-expanded={showHistory}
            aria-controls={historyId}
            onClick={() => setShowHistory((s) => !s)}
          >
            {loan.repayments.length === 1
              ? tr(copy.oneEntry)
              : tr(copy.manyEntries, { count: loan.repayments.length })}
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                showHistory && 'rotate-180',
              )}
            />
          </button>
          {showHistory && (
            <ul id={historyId} className="divide-y border-t bg-muted/20">
              {loan.repayments.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular">{money(r.amount)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fmtDate(r.paidOn)}
                      {r.notes && ` · ${r.notes}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tr(copy.removeEntry, { v0: money(r.amount) })}
                    onClick={() => onUndoRepayment(r)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function LoansView() {
  const { t: tr } = useLanguage();
  const query = useLoans();
  const removeLoan = useDeleteLoan();
  const removeRepayment = useDeleteRepayment();
  const { money } = useFormatters();
  const [tab, setTab] = React.useState<LoanDirection>('BORROWED');
  const [editing, setEditing] = React.useState<{ open: boolean; loan?: Loan }>({ open: false });
  const [repaying, setRepaying] = React.useState<Loan | null>(null);
  const [deleting, setDeleting] = React.useState<Loan | null>(null);
  const [undoing, setUndoing] = React.useState<{ loan: Loan; repayment: LoanRepayment } | null>(
    null,
  );

  const copy = LOAN_COPY[tab];
  const loans = (query.data?.loans ?? []).filter((l) => l.direction === tab);
  const totals = query.data?.totals[tab];
  const open = loans.filter((l) => l.status !== 'paid');
  const settled = loans.filter((l) => l.status === 'paid');
  const add = () => setEditing({ open: true });

  const card = (loan: Loan) => (
    <LoanCard
      key={loan.id}
      loan={loan}
      onRepay={() => setRepaying(loan)}
      onEdit={() => setEditing({ open: true, loan })}
      onDelete={() => setDeleting(loan)}
      onUndoRepayment={(repayment) => setUndoing({ loan, repayment })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('Loans')}
        description={tr(
          "Track money you've borrowed and money you've lent, with every repayment until it's settled.",
        )}
        actions={
          <Button onClick={add}>
            <Plus /> {tr('Add loan')}
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label={tr('Loan type')}
        className="inline-flex gap-1 rounded-lg bg-muted p-1"
      >
        {(['BORROWED', 'LENT'] as const).map((direction) => {
          const openCount = query.data?.totals[direction].activeCount ?? 0;
          return (
            <button
              key={direction}
              type="button"
              role="tab"
              aria-selected={tab === direction}
              onClick={() => setTab(direction)}
              className={cn(
                'flex h-8 items-center gap-2 rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                tab === direction && 'bg-card text-foreground shadow-xs',
              )}
            >
              {tr(LOAN_COPY[direction].tab)}
              {openCount > 0 && (
                <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular">
                  {openCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-7 w-32" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} className="space-y-4 p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-2 w-full" />
              </Card>
            ))}
          </div>
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState onRetry={() => query.refetch()} />
        </Card>
      ) : loans.length === 0 ? (
        <Card>
          <EmptyState
            icon={DIRECTION_ICON[tab]}
            title={tr(copy.emptyTitle)}
            description={tr(copy.emptyDescription)}
            action={
              <Button onClick={add}>
                <Plus /> {tr(copy.emptyAction)}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {totals && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryTile
                emphasis
                label={tr(copy.summaryOutstanding)}
                value={money(totals.outstanding)}
                hint={
                  totals.overdueCount > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="size-3.5" />
                      {tr('{count} overdue', { count: totals.overdueCount })}
                    </span>
                  ) : (
                    tr(totals.activeCount === 1 ? '1 open loan' : '{count} open loans', {
                      count: totals.activeCount,
                    })
                  )
                }
              />
              <SummaryTile label={tr(copy.summaryTotal)} value={money(totals.amount)} />
              <SummaryTile label={tr(copy.summaryRepaid)} value={money(totals.repaid)} />
            </div>
          )}

          {open.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{tr(copy.sectionOpen)}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{open.map(card)}</div>
            </section>
          )}

          {settled.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{tr(copy.sectionSettled)}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{settled.map(card)}</div>
            </section>
          )}
        </>
      )}

      <LoanDialog
        open={editing.open}
        loan={editing.loan}
        defaultDirection={tab}
        onOpenChange={(isOpen) => setEditing((d) => ({ ...d, open: isOpen }))}
      />
      <RepayDialog loan={repaying} onOpenChange={(isOpen) => !isOpen && setRepaying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={tr('Delete this loan?')}
        description={
          deleting &&
          tr(LOAN_COPY[deleting.direction].deleteDescription, { name: deleting.counterparty })
        }
        onConfirm={() => removeLoan.mutateAsync(deleting!.id)}
      />
      <ConfirmDialog
        open={undoing !== null}
        onOpenChange={(o) => !o && setUndoing(null)}
        title={undoing ? tr(LOAN_COPY[undoing.loan.direction].undoTitle) : ''}
        confirmLabel="Remove"
        description={
          undoing &&
          tr(LOAN_COPY[undoing.loan.direction].undoDescription, {
            v0: money(undoing.repayment.amount),
            name: undoing.loan.counterparty,
          })
        }
        onConfirm={() =>
          removeRepayment.mutateAsync({ id: undoing!.loan.id, repaymentId: undoing!.repayment.id })
        }
      />
    </div>
  );
}
