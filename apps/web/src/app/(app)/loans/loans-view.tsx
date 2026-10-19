'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Loan, LoanRepayment, LoanStatus } from '@expense/shared';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  HandCoins,
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

const STATUS_BADGE: Record<
  LoanStatus,
  { label: string; variant: 'default' | 'destructive' | 'secondary' }
> = {
  active: { label: 'Owed', variant: 'default' },
  overdue: { label: 'Overdue', variant: 'destructive' },
  paid: { label: 'Paid off', variant: 'secondary' },
};

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
  const badge = STATUS_BADGE[loan.status];
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
            {isPaid ? <CheckCircle2 className="size-5" /> : <HandCoins className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{loan.lender}</p>
              <Badge variant={badge.variant}>
                {loan.status === 'overdue' && <AlertTriangle />}
                {tr(badge.label)}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tr('Borrowed {v0}', { v0: fmtDate(loan.borrowedOn) })}
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
                aria-label={tr('Actions for {v0}', { v0: loan.lender })}
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
              {isPaid ? tr('Repaid in full') : tr('Still owed')}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular">
              {money(isPaid ? loan.amount : loan.outstanding)}
            </p>
          </div>
          {!isPaid && (
            <Button size="sm" onClick={onRepay}>
              <Undo2 /> {tr('Repay')}
            </Button>
          )}
        </div>

        <Progress
          className="mt-4"
          value={loan.percentRepaid}
          indicatorClassName={cn(isPaid && 'bg-muted-foreground/50')}
          aria-label={tr('Repaid')}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular">
          <span>
            {tr('{v0} repaid', { v0: money(loan.repaid) })} ·{' '}
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
              ? tr('1 repayment')
              : tr('{count} repayments', { count: loan.repayments.length })}
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
                    aria-label={tr('Remove repayment of {v0}', { v0: money(r.amount) })}
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
  const [editing, setEditing] = React.useState<{ open: boolean; loan?: Loan }>({ open: false });
  const [repaying, setRepaying] = React.useState<Loan | null>(null);
  const [deleting, setDeleting] = React.useState<Loan | null>(null);
  const [undoing, setUndoing] = React.useState<{ loan: Loan; repayment: LoanRepayment } | null>(
    null,
  );

  const loans = query.data?.loans ?? [];
  const totals = query.data?.totals;
  const owed = loans.filter((l) => l.status !== 'paid');
  const paid = loans.filter((l) => l.status === 'paid');

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
        description={tr("Track money you've borrowed and every repayment until it's paid off.")}
        actions={
          <Button onClick={() => setEditing({ open: true })}>
            <Plus /> {tr('Add loan')}
          </Button>
        }
      />

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
            icon={HandCoins}
            title={tr('No loans yet')}
            description={tr(
              'When you borrow money, add it here. Record each repayment and see what you still owe.',
            )}
            action={
              <Button onClick={() => setEditing({ open: true })}>
                <Plus /> {tr('Add your first loan')}
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
                label={tr('You still owe')}
                value={money(totals.outstanding)}
                hint={
                  totals.overdueCount > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="size-3.5" />
                      {tr('{count} overdue', { count: totals.overdueCount })}
                    </span>
                  ) : (
                    tr('{count} open loans', { count: totals.activeCount })
                  )
                }
              />
              <SummaryTile label={tr('Total borrowed')} value={money(totals.borrowed)} />
              <SummaryTile label={tr('Total repaid')} value={money(totals.repaid)} />
            </div>
          )}

          {owed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{tr('Still owed')}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{owed.map(card)}</div>
            </section>
          )}

          {paid.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{tr('Paid off')}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{paid.map(card)}</div>
            </section>
          )}
        </>
      )}

      <LoanDialog
        open={editing.open}
        loan={editing.loan}
        onOpenChange={(open) => setEditing((d) => ({ ...d, open }))}
      />
      <RepayDialog loan={repaying} onOpenChange={(open) => !open && setRepaying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={tr('Delete this loan?')}
        description={
          deleting &&
          tr('The loan from “{name}” and all its repayments will be removed permanently.', {
            name: deleting.lender,
          })
        }
        onConfirm={() => removeLoan.mutateAsync(deleting!.id)}
      />
      <ConfirmDialog
        open={undoing !== null}
        onOpenChange={(o) => !o && setUndoing(null)}
        title={tr('Remove this repayment?')}
        confirmLabel="Remove"
        description={
          undoing &&
          tr('{v0} will be added back to what you owe {name}.', {
            v0: money(undoing.repayment.amount),
            name: undoing.loan.lender,
          })
        }
        onConfirm={() =>
          removeRepayment.mutateAsync({ id: undoing!.loan.id, repaymentId: undoing!.repayment.id })
        }
      />
    </div>
  );
}
