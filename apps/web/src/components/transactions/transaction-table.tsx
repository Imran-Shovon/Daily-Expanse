'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { PAYMENT_METHOD_LABELS, type Transaction } from '@expense/shared';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Repeat,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { CategoryBadge, CategoryIcon } from '@/components/common/category-icon';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormattedDate } from '@/components/common/formatted-date';
import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDeleteTransaction } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';
import { TransactionDialog } from './transaction-dialog';

export type SortField = 'date' | 'amount' | 'title';
export interface SortState {
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
}

function SortHeader({
  field,
  label,
  sort,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sort?: SortState;
  onSort?: (s: SortState) => void;
  className?: string;
}) {
  const { t: tr } = useLanguage();
  if (!sort || !onSort) return <TableHead className={className}>{tr(label)}</TableHead>;
  const active = sort.sortBy === field;
  const Icon = !active ? ArrowUpDown : sort.sortOrder === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        className={cn(
          'inline-flex items-center gap-1 uppercase hover:text-foreground',
          active && 'text-foreground',
          className?.includes('text-right') && 'flex-row-reverse',
        )}
        onClick={() =>
          onSort({ sortBy: field, sortOrder: active && sort.sortOrder === 'desc' ? 'asc' : 'desc' })
        }
      >
        {tr(label)}
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}

function RowActions({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t: tr } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={tr('Actions for {v0}', { v0: transaction.title })}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> {tr('Edit')}{' '}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> {tr('Delete')}{' '}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Responsive transaction list: a sortable table on desktop and a stacked list on mobile.
 * Rows open the details page; edit and delete are available from the row menu.
 */
export function TransactionTable({
  transactions,
  sort,
  onSort,
  compact = false,
}: {
  transactions: Transaction[];
  sort?: SortState;
  onSort?: (s: SortState) => void;
  compact?: boolean;
}) {
  const { t: tr } = useLanguage();
  const router = useRouter();
  const [editing, setEditing] = React.useState<Transaction | null>(null);
  const [deleting, setDeleting] = React.useState<Transaction | null>(null);
  const remove = useDeleteTransaction();

  const open = (t: Transaction) => router.push(`/transactions/${t.id}`);

  return (
    <>
      {/* Mobile list */}
      <ul className={cn('divide-y', !compact && 'md:hidden')}>
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center gap-1 pr-2">
            <Link
              href={`/transactions/${t.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 px-5 py-3 outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
            >
              <CategoryIcon icon={t.category.icon} color={t.category.color} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{t.title}</span>
                  {t.recurringTransactionId && (
                    <Repeat
                      className="size-3 shrink-0 text-muted-foreground"
                      aria-label={tr('Recurring')}
                    />
                  )}
                </p>
                {/* The date always shows in full; a long category name gives way. */}
                <p className="flex min-w-0 gap-1 text-xs text-muted-foreground">
                  <FormattedDate date={t.date} className="shrink-0" />
                  <span aria-hidden>·</span>
                  <span className="truncate">{t.category.name}</span>
                </p>
              </div>
              <Money
                amount={t.amount}
                type={t.type}
                className="shrink-0 text-sm whitespace-nowrap"
              />
            </Link>
            {!compact && (
              <RowActions
                transaction={t}
                onEdit={() => setEditing(t)}
                onDelete={() => setDeleting(t)}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      {!compact && (
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHeader field="title" label={tr('Transaction')} sort={sort} onSort={onSort} />
                <TableHead>{tr('Category')}</TableHead>
                <SortHeader field="date" label={tr('Date')} sort={sort} onSort={onSort} />
                <TableHead className="hidden lg:table-cell">{tr('Method')}</TableHead>
                <SortHeader
                  field="amount"
                  label={tr('Amount')}
                  sort={sort}
                  onSort={onSort}
                  className="text-right"
                />
                <TableHead className="w-12">
                  <span className="sr-only">{tr('Actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => open(t)}
                  onKeyDown={(e) => {
                    if (e.key === tr('Enter')) open(t);
                  }}
                  tabIndex={0}
                  aria-label={tr('{v0}, open details', { v0: t.title })}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" />
                      <div className="min-w-0">
                        <p className="flex max-w-[22rem] items-center gap-1.5 truncate font-medium">
                          <span className="truncate">{t.title}</span>
                          {t.recurringTransactionId && (
                            <Repeat
                              className="size-3 shrink-0 text-muted-foreground"
                              aria-label={tr('Recurring')}
                            />
                          )}
                        </p>
                        {t.tags.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground">
                            {t.tags.map((tag) => `#${tag}`).join(' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={t.category} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <FormattedDate date={t.date} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {tr(PAYMENT_METHOD_LABELS[t.paymentMethod])}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Money amount={t.amount} type={t.type} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      transaction={t}
                      onEdit={() => setEditing(t)}
                      onDelete={() => setDeleting(t)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TransactionDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        transaction={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={tr('Delete this transaction?')}
        description={
          deleting && (
            <>
              <span className="font-medium text-foreground">{deleting.title}</span>{' '}
              {tr('will be removed permanently and your totals and budgets will update.')}
            </>
          )
        }
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </>
  );
}
