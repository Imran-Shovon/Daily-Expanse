'use client';

import type { ReportGranularity } from '@expense/shared';
import { Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/common/category-icon';
import { DateRangeFilter, useDateRangeParams } from '@/components/common/date-range-filter';
import { FormattedDate } from '@/components/common/formatted-date';
import { Money, useFormatters } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/states';
import { ChartCard } from '@/components/dashboard/chart-card';
import {
  CategoryDonut,
  IncomeExpenseChart,
  NetSavingsChart,
  SpendingTrendChart,
} from '@/components/dashboard/charts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reportsApi } from '@/lib/api/endpoints';
import {
  errorMessage,
  useCategoryBreakdown,
  useIncomeExpenseReport,
  useTransactionReport,
} from '@/lib/api/hooks';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

const GRANULARITIES: { value: ReportGranularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Annual' },
];

function Kpi({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <p className="mt-1 text-xl font-semibold tracking-tight tabular">{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ReportsView() {
  const { money } = useFormatters();
  const [range, setRange] = useDateRangeParams();
  const [granularity, setGranularity] = React.useState<ReportGranularity | undefined>(undefined);
  const [exporting, setExporting] = React.useState(false);

  const report = useTransactionReport(range, granularity);
  const incomeExpense = useIncomeExpenseReport(range, granularity);
  const expenseBreakdown = useCategoryBreakdown(range, 'EXPENSE');
  const incomeBreakdown = useCategoryBreakdown(range, 'INCOME');
  const activeGranularity = granularity ?? report.data?.granularity ?? 'day';
  const totals = incomeExpense.data?.totals;
  const empty = report.data && report.data.totals.count === 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const filename = await reportsApi.exportCsv(range);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error('Export failed', { description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Understand trends across days, weeks, months and years."
        actions={
          <>
            <DateRangeFilter value={range} onChange={(r) => r && setRange(r)} />
            <Button variant="outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
            </Button>
          </>
        }
      />

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Kpi label="Income" loading={!totals} value={totals && money(totals.income)} />
        <Kpi label="Expenses" loading={!totals} value={totals && money(totals.expenses)} />
        <Kpi
          label="Net savings"
          loading={!totals}
          value={
            totals && (
              <span className={cn(Number(totals.net) < 0 && 'text-destructive')}>
                {money(totals.net, { signed: true })}
              </span>
            )
          }
        />
        <Kpi
          label="Savings rate"
          loading={!totals}
          value={totals && formatPercent(totals.savingsRate)}
          sub={totals?.savingsRate === null ? 'No income in range' : undefined}
        />
        <Kpi
          label="Avg. daily spend"
          loading={!report.data}
          value={report.data && money(report.data.averageDailyExpense)}
          sub={report.data && `${report.data.totals.count} transactions`}
        />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeGranularity}
          onValueChange={(v) => setGranularity(v as ReportGranularity)}
        >
          <TabsList aria-label="Report granularity">
            {GRANULARITIES.map((g) => (
              <TabsTrigger key={g.value} value={g.value}>
                {g.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {granularity && (
          <Button variant="ghost" size="sm" onClick={() => setGranularity(undefined)}>
            Auto granularity
          </Button>
        )}
      </div>

      {empty ? (
        <Card>
          <EmptyState
            icon={Download}
            title="Nothing to report for this period"
            description="Pick another date range or add transactions to see reports."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Expense report"
              description="Total spending per period"
              loading={report.isLoading}
              error={report.isError}
              onRetry={() => report.refetch()}
            >
              {report.data && <SpendingTrendChart points={report.data.periods} height={260} />}
            </ChartCard>
            <ChartCard
              title="Income vs expenses"
              loading={incomeExpense.isLoading}
              error={incomeExpense.isError}
              onRetry={() => incomeExpense.refetch()}
            >
              {incomeExpense.data && (
                <IncomeExpenseChart points={incomeExpense.data.points} height={228} />
              )}
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Savings trend"
              description={
                incomeExpense.data &&
                `Saved ${money(incomeExpense.data.points.at(-1)?.cumulativeNet ?? '0', { signed: true })} in total across this range`
              }
              loading={incomeExpense.isLoading}
              error={incomeExpense.isError}
              onRetry={() => incomeExpense.refetch()}
            >
              {incomeExpense.data && (
                <NetSavingsChart points={incomeExpense.data.points} height={240} />
              )}
            </ChartCard>
            <ChartCard
              title="Expenses by category"
              loading={expenseBreakdown.isLoading}
              error={expenseBreakdown.isError}
              onRetry={() => expenseBreakdown.refetch()}
            >
              {expenseBreakdown.data &&
                (expenseBreakdown.data.items.length ? (
                  <CategoryDonut
                    items={expenseBreakdown.data.items}
                    total={expenseBreakdown.data.total}
                    limit={7}
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No expenses in this range.
                  </p>
                ))}
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[15px] font-semibold tracking-tight">Largest expenses</h3>
                <p className="text-sm text-muted-foreground">
                  The ten biggest outgoing transactions in this range
                </p>
              </div>
              {report.isLoading ? (
                <div className="space-y-2 px-5 pb-5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : report.data && report.data.largestExpenses.length > 0 ? (
                <ol className="divide-y border-t">
                  {report.data.largestExpenses.map((t, i) => (
                    <li key={t.id}>
                      <Link
                        href={`/transactions/${t.id}`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40"
                      >
                        <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
                        <CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.category.name} · <FormattedDate date={t.date} />
                          </span>
                        </span>
                        <Money amount={t.amount} className="text-sm font-semibold" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 pb-6 text-sm text-muted-foreground">
                  No expenses in this range.
                </p>
              )}
            </Card>
            <ChartCard
              title="Income sources"
              className="xl:col-span-2"
              loading={incomeBreakdown.isLoading}
              error={incomeBreakdown.isError}
              onRetry={() => incomeBreakdown.refetch()}
            >
              {incomeBreakdown.data &&
                (incomeBreakdown.data.items.length ? (
                  <ul className="space-y-3">
                    {incomeBreakdown.data.items.map((item) => (
                      <li key={item.category.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-[3px]"
                              style={{ backgroundColor: item.category.color }}
                              aria-hidden
                            />
                            <span className="truncate">{item.category.name}</span>
                          </span>
                          <span className="font-medium tabular">{money(item.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: item.category.color,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No income in this range.
                  </p>
                ))}
            </ChartCard>
          </div>

          {incomeExpense.data && (
            <Card>
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-[15px] font-semibold tracking-tight">Period breakdown</h3>
                <p className="text-sm text-muted-foreground">The numbers behind the charts above</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Savings rate</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Cumulative</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeExpense.data.points.map((p) => (
                    <TableRow key={p.date}>
                      <TableCell className="font-medium whitespace-nowrap">{p.label}</TableCell>
                      <TableCell className="text-right tabular">{money(p.income)}</TableCell>
                      <TableCell className="text-right tabular">{money(p.expenses)}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular',
                          Number(p.net) < 0 && 'text-destructive',
                        )}
                      >
                        {money(p.net, { signed: true })}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular">
                        {formatPercent(p.savingsRate)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular sm:table-cell">
                        {money(p.cumulativeNet)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
