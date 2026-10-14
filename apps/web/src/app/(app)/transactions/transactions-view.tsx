'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  type TransactionType,
} from '@expense/shared';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Receipt,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { DateRangeFilter, useDateRangeParams } from '@/components/common/date-range-filter';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states';
import { useQuickAdd } from '@/components/transactions/transaction-dialog';
import { TransactionTable, type SortState } from '@/components/transactions/transaction-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { reportsApi, type TransactionFilters } from '@/lib/api/endpoints';
import { errorMessage, useCategories, useTransactions } from '@/lib/api/hooks';

const ALL = 'all';
const PAGE_SIZE = 20;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function TransactionsView() {
  const { t: tr, number } = useLanguage();
  const quickAdd = useQuickAdd();
  const categories = useCategories();
  const [range, setRange] = useDateRangeParams({ allowAll: true });
  const [search, setSearch] = React.useState('');
  const [type, setType] = React.useState<TransactionType | typeof ALL>(ALL);
  const [categoryId, setCategoryId] = React.useState<string>(ALL);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | typeof ALL>(ALL);
  const [sort, setSort] = React.useState<SortState>({ sortBy: 'date', sortOrder: 'desc' });
  const [exporting, setExporting] = React.useState(false);
  const debouncedSearch = useDebounced(search.trim());

  const baseFilters: Omit<TransactionFilters, 'page'> = {
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type: type === ALL ? undefined : type,
    categoryId: categoryId === ALL ? undefined : categoryId,
    paymentMethod: paymentMethod === ALL ? undefined : paymentMethod,
    ...(range
      ? range.range === 'custom'
        ? { from: range.from, to: range.to }
        : { range: range.range }
      : {}),
    ...sort,
  };

  // The page belongs to one filter combination; changing any filter returns to page 1.
  const filterKey = JSON.stringify(baseFilters);
  const [pageState, setPageState] = React.useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (update: (p: number) => number) =>
    setPageState({ key: filterKey, page: update(page) });
  const filters: TransactionFilters = { ...baseFilters, page };

  const query = useTransactions(filters);
  const data = query.data;
  const hasFilters = Boolean(
    debouncedSearch || type !== ALL || categoryId !== ALL || paymentMethod !== ALL || range,
  );

  const clearFilters = () => {
    setSearch('');
    setType(ALL);
    setCategoryId(ALL);
    setPaymentMethod(ALL);
    setRange(null);
  };

  const visibleCategories = (categories.data ?? []).filter((c) => type === ALL || c.type === type);

  const exportCsv = async () => {
    if (!range) {
      toast.info(tr('Choose a date range to export'), {
        description: tr('Exports cover a specific period, e.g. this month or this year.'),
      });
      return;
    }
    setExporting(true);
    try {
      const filename = await reportsApi.exportCsv(range, { type: type === ALL ? undefined : type });
      toast.success(tr('Downloaded {v0}', { v0: filename }));
    } catch (e) {
      toast.error(tr('Export failed'), { description: tr(errorMessage(e)) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('Transactions')}
        description={tr('Every income and expense, searchable and filterable.')}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              <Download /> {tr('Export CSV')}{' '}
            </Button>
            <Button onClick={() => quickAdd()}>
              <Plus /> {tr('New transaction')}{' '}
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={tr('Search title or notes…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label={tr('Search transactions')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as TransactionType | typeof ALL);
                setCategoryId(ALL);
              }}
            >
              <SelectTrigger className="sm:w-32" aria-label={tr('Type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tr('All types')}</SelectItem>
                <SelectItem value="EXPENSE">{tr('Expenses')}</SelectItem>
                <SelectItem value="INCOME">{tr('Income')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="sm:w-44" aria-label={tr('Category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tr('All categories')}</SelectItem>
                <SelectSeparator />
                {visibleCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod | typeof ALL)}
            >
              <SelectTrigger className="sm:w-40" aria-label={tr('Payment method')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{tr('All methods')}</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {tr(PAYMENT_METHOD_LABELS[m])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangeFilter
              value={range}
              onChange={setRange}
              allowAll
              className="col-span-2 sm:col-span-1"
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="self-start lg:self-auto"
            >
              <X /> {tr('Clear')}{' '}
            </Button>
          )}
        </div>

        {query.isLoading ? (
          <LoadingSkeleton variant="table" rows={8} />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : data && data.data.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title={tr('No matching transactions')}
              description={tr('Try a different search term or remove some filters.')}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {tr('Clear filters')}{' '}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Receipt}
              title={tr('No transactions yet')}
              description={tr(
                'Start by adding your first expense or income. It only takes a few seconds.',
              )}
              action={
                <Button onClick={() => quickAdd()}>
                  <Plus /> {tr('Add transaction')}{' '}
                </Button>
              }
            />
          )
        ) : (
          data && (
            <div
              className={query.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}
            >
              <TransactionTable transactions={data.data} sort={sort} onSort={setSort} />
            </div>
          )
        )}

        {data && data.meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-5 py-3 text-sm sm:flex-row">
            <p className="text-muted-foreground">
              {tr('Showing')}{' '}
              <span className="font-medium text-foreground tabular">
                {number((data.meta.page - 1) * data.meta.pageSize + 1)}–
                {number(Math.min(data.meta.page * data.meta.pageSize, data.meta.total))}
              </span>{' '}
              {tr('of')}{' '}
              <span className="font-medium text-foreground tabular">{number(data.meta.total)}</span>
            </p>
            <nav className="flex items-center gap-2" aria-label={tr('Pagination')}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft /> {tr('Previous')}{' '}
              </Button>
              <span className="px-1 text-muted-foreground tabular">
                {number(data.meta.page)} / {number(data.meta.totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
              >
                {tr('Next')} <ChevronRight />
              </Button>
            </nav>
          </div>
        )}
      </Card>
    </div>
  );
}
