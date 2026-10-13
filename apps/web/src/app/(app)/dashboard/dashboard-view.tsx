'use client';

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  OctagonAlert,
  PiggyBank,
  Plus,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { BudgetProgress } from '@/components/budgets/budget-progress';
import {
  DateRangeFilter,
  rangeLabel,
  useDateRangeParams,
} from '@/components/common/date-range-filter';
import { useFormatters } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states';
import { ChartCard } from '@/components/dashboard/chart-card';
import {
  CategoryDonut,
  IncomeExpenseChart,
  SpendingTrendChart,
} from '@/components/dashboard/charts';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { useQuickAdd } from '@/components/transactions/transaction-dialog';
import { TransactionTable } from '@/components/transactions/transaction-table';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useCategoryBreakdown, useDashboardSummary, useSpendingTrends } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function DashboardView() {
  const user = useUser();
  const { money } = useFormatters();
  const quickAdd = useQuickAdd();
  const [range, setRange] = useDateRangeParams();
  const summary = useDashboardSummary(range);
  const trends = useSpendingTrends(range);
  const breakdown = useCategoryBreakdown(range, 'EXPENSE');
  const s = summary.data;
  const isEmpty = s && s.transactionCount === 0;
  const net = s ? Number(s.netBalance) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description={`Here is your money at a glance for ${rangeLabel(range, user.dateFormat).toLowerCase()}.`}
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {summary.isError ? (
        <Card>
          <ErrorState onRetry={() => summary.refetch()} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Income"
            icon={ArrowUpRight}
            tone="income"
            loading={summary.isLoading}
            value={s && money(s.totalIncome)}
            hint="Money in during this period"
          />
          <SummaryCard
            label="Expenses"
            icon={ArrowDownRight}
            tone="expense"
            loading={summary.isLoading}
            value={s && money(s.totalExpenses)}
            hint={s && `${s.transactionCount} transaction${s.transactionCount === 1 ? '' : 's'}`}
          />
          <SummaryCard
            label="Net for period"
            icon={Scale}
            tone="accent"
            loading={summary.isLoading}
            value={
              s && (
                <span className={cn(net < 0 && 'text-destructive')}>
                  {money(s.netBalance, { signed: true })}
                </span>
              )
            }
            hint={s && <>Running balance {money(s.cumulativeBalance)}</>}
          />
          <SummaryCard
            label="Savings rate"
            icon={PiggyBank}
            loading={summary.isLoading}
            value={s && formatPercent(s.savingsRate)}
            hint={
              s &&
              (s.savingsRate === null
                ? 'No income recorded in this period'
                : `${money(s.netBalance)} kept from ${money(s.totalIncome)}`)
            }
          />
        </div>
      )}

      {s && s.budgetAlerts.length > 0 && (
        <div className="space-y-2" aria-label="Budget warnings">
          {s.budgetAlerts.map((alert) => {
            const exceeded = alert.state === 'exceeded';
            const Icon = exceeded ? OctagonAlert : AlertTriangle;
            return (
              <Link
                key={alert.budgetId}
                href="/budgets"
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
                  exceeded
                    ? 'border-destructive/25 bg-destructive/5 hover:bg-destructive/10'
                    : 'border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    exceeded ? 'text-destructive' : 'text-amber-600 dark:text-amber-400',
                  )}
                />
                <p className="min-w-0 flex-1">
                  <span className="font-medium">{alert.name}</span>{' '}
                  <span className="text-muted-foreground">
                    {exceeded ? 'is over budget' : 'is close to its limit'} — {money(alert.spent)}{' '}
                    of {money(alert.amount)} ({formatPercent(alert.percentUsed)})
                  </span>
                </p>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}

      {isEmpty ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No transactions in this period"
            description="Add your first income or expense, or pick a different date range to see your charts."
            action={
              <Button onClick={() => quickAdd()}>
                <Plus /> Add transaction
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <ChartCard
              title="Income vs expenses"
              description={trends.data && `Grouped by ${trends.data.granularity}`}
              loading={trends.isLoading}
              error={trends.isError}
              onRetry={() => trends.refetch()}
              className="xl:col-span-3"
            >
              {trends.data && <IncomeExpenseChart points={trends.data.points} />}
            </ChartCard>
            <ChartCard
              title="Spending by category"
              description="Where your money went"
              loading={breakdown.isLoading}
              error={breakdown.isError}
              onRetry={() => breakdown.refetch()}
              className="xl:col-span-2"
            >
              {breakdown.data &&
                (breakdown.data.items.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="No expenses yet"
                    description="Expenses in this period will show up here."
                    className="py-8"
                  />
                ) : (
                  <CategoryDonut items={breakdown.data.items} total={breakdown.data.total} />
                ))}
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle>Recent transactions</CardTitle>
                <Button asChild variant="ghost" size="sm" className="-mt-1 -mr-2">
                  <Link href="/transactions">
                    View all <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              {summary.isLoading ? (
                <LoadingSkeleton variant="list" rows={5} />
              ) : (
                s && <TransactionTable transactions={s.recentTransactions} compact />
              )}
            </Card>

            <div className="flex flex-col gap-4 xl:col-span-2">
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold tracking-tight">Monthly budget</p>
                    <p className="text-sm text-muted-foreground">
                      {s?.monthlyBudget ? 'Overall spending limit' : 'Set a limit to stay on track'}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="-mt-1 -mr-2">
                    <Link href="/budgets">Manage</Link>
                  </Button>
                </div>
                <div className="mt-4">
                  {summary.isLoading ? (
                    <LoadingSkeleton variant="list" rows={1} />
                  ) : s?.monthlyBudget ? (
                    <>
                      <p className="mb-3 text-2xl font-semibold tracking-tight tabular">
                        {formatPercent(s.monthlyBudget.status.percentUsed)}
                        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                          used
                        </span>
                      </p>
                      <BudgetProgress
                        amount={s.monthlyBudget.amount}
                        status={s.monthlyBudget.status}
                      />
                    </>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/budgets">
                        <Plus /> Create a monthly budget
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>

              <ChartCard
                title="Spending trend"
                loading={trends.isLoading}
                error={trends.isError}
                onRetry={() => trends.refetch()}
                className="flex-1"
              >
                {trends.data && <SpendingTrendChart points={trends.data.points} height={170} />}
              </ChartCard>
            </div>
          </div>

          {breakdown.data && breakdown.data.items.length > 0 && (
            <Card className="p-5">
              <p className="text-[15px] font-semibold tracking-tight">Top spending categories</p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {breakdown.data.items.slice(0, 3).map((item, index) => (
                  <li
                    key={item.category.id}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
                  >
                    <span className="text-xs font-semibold text-muted-foreground tabular">
                      {index + 1}
                    </span>
                    <span
                      className="size-2.5 rounded-[3px]"
                      style={{ backgroundColor: item.category.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.category.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.transactionCount} transaction{item.transactionCount === 1 ? '' : 's'}{' '}
                        · {formatPercent(item.percentage)}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular">{money(item.total)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
