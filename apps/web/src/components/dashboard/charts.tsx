'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { CategoryBreakdownItem, TrendPoint } from '@expense/shared';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFormatters } from '@/components/common/money';
import { formatPercent } from '@/lib/format';
import { localizePeriodLabel, type Language } from '@/lib/i18n/translate';
import { ChartLegend } from './chart-card';

const INCOME = 'var(--chart-income)';
const EXPENSE = 'var(--chart-expense)';
const NET = 'var(--chart-net)';
const GRID = 'var(--chart-grid)';
const AXIS = 'var(--chart-axis)';

const axisProps = {
  stroke: AXIS,
  tickLine: false,
  axisLine: false,
  fontSize: 11,
  tick: { fill: AXIS },
} as const;

interface TooltipRow {
  label: string;
  color: string;
  value: string;
}

function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              {row.label}
            </span>
            <span className="font-medium text-foreground tabular">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ChartDatum = TrendPoint & { incomeValue: number; expenseValue: number; netValue: number };

function toChartData(points: TrendPoint[], language: Language): ChartDatum[] {
  // Numbers are only used for plotting; displayed values come from the decimal strings.
  return points.map((p) => ({
    ...p,
    label: localizePeriodLabel(p.label, language),
    incomeValue: Number(p.income),
    expenseValue: Number(p.expenses),
    netValue: Number(p.net),
  }));
}

/** Pick roughly 6-8 x-axis labels regardless of bucket count. */
function tickInterval(count: number) {
  return count <= 8 ? 0 : Math.ceil(count / 7) - 1;
}

export function IncomeExpenseChart({
  points,
  height = 260,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  const { t: tr, language } = useLanguage();
  const { money } = useFormatters();
  const data = toChartData(points, language);
  return (
    <div className="space-y-3">
      <ChartLegend
        items={[
          { label: tr('Income'), color: INCOME },
          { label: tr('Expenses'), color: EXPENSE },
        ]}
      />
      <div
        style={{ height }}
        role="img"
        aria-label={tr('Bar chart comparing income and expenses over time')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="22%"
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              {...axisProps}
              interval={tickInterval(data.length)}
              minTickGap={8}
            />
            <YAxis
              {...axisProps}
              width={56}
              tickFormatter={(v: number) => money(v, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as ChartDatum | undefined;
                if (!active || !d) return null;
                return (
                  <TooltipBox
                    title={d.label}
                    rows={[
                      { label: tr('Income'), color: INCOME, value: money(d.income) },
                      { label: tr('Expenses'), color: EXPENSE, value: money(d.expenses) },
                      { label: tr('Net'), color: NET, value: money(d.net, { signed: true }) },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="incomeValue"
              name={tr('Income')}
              fill={INCOME}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="expenseValue"
              name={tr('Expenses')}
              fill={EXPENSE}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SpendingTrendChart({
  points,
  height = 220,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  const { t: tr, language } = useLanguage();
  const { money } = useFormatters();
  const data = toChartData(points, language);
  return (
    <div style={{ height }} role="img" aria-label={tr('Area chart of spending over time')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={EXPENSE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={EXPENSE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            {...axisProps}
            interval={tickInterval(data.length)}
            minTickGap={8}
          />
          <YAxis
            {...axisProps}
            width={56}
            tickFormatter={(v: number) => money(v, { compact: true })}
          />
          <Tooltip
            cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as ChartDatum | undefined;
              if (!active || !d) return null;
              return (
                <TooltipBox
                  title={d.label}
                  rows={[{ label: tr('Spent'), color: EXPENSE, value: money(d.expenses) }]}
                />
              );
            }}
          />
          <Area
            type="linear"
            dataKey="expenseValue"
            stroke={EXPENSE}
            strokeWidth={2}
            fill="url(#spend-fill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Net savings per period (income − expenses), positive above the baseline. */
export function NetSavingsChart({
  points,
  height = 220,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  const { t: tr, language } = useLanguage();
  const { money } = useFormatters();
  const data = toChartData(points, language);
  return (
    <div style={{ height }} role="img" aria-label={tr('Bar chart of net savings per period')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            {...axisProps}
            interval={tickInterval(data.length)}
            minTickGap={8}
          />
          <YAxis
            {...axisProps}
            width={56}
            tickFormatter={(v: number) => money(v, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as ChartDatum | undefined;
              if (!active || !d) return null;
              return (
                <TooltipBox
                  title={d.label}
                  rows={[
                    { label: tr('Net savings'), color: NET, value: money(d.net, { signed: true }) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="netValue" fill={NET} radius={[4, 4, 4, 4]} maxBarSize={32}>
            {data.map((d) => (
              <Cell key={d.date} fillOpacity={d.netValue < 0 ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Category share donut. Slices use each category's own color so a category looks the same
 * everywhere; the list beside it carries names, amounts and percentages.
 */
export function CategoryDonut({
  items,
  total,
  limit = 6,
}: {
  items: CategoryBreakdownItem[];
  total: string;
  limit?: number;
}) {
  const { t: tr, locale } = useLanguage();
  const { money } = useFormatters();
  const top = items.slice(0, limit);
  const rest = items.slice(limit);
  const restTotal = rest.reduce((s, i) => s + Number(i.total), 0);
  const slices = [
    ...top.map((i) => ({
      key: i.category.id,
      name: i.category.name,
      color: i.category.color,
      value: Number(i.total),
      display: i.total,
      pct: i.percentage,
    })),
    ...(rest.length
      ? [
          {
            key: 'other',
            name: tr('Other ({v0})', { v0: rest.length }),
            color: 'var(--chart-axis)',
            value: restTotal,
            display: restTotal.toFixed(2),
            pct: rest.reduce((s, i) => s + i.percentage, 0),
          },
        ]
      : []),
  ];

  return (
    <div className="@container">
      <div className="grid items-center gap-6 @lg:grid-cols-[180px_minmax(0,1fr)]">
        <div
          className="relative mx-auto size-[180px]"
          role="img"
          aria-label={tr('Donut chart of spending by category')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={86}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {slices.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const s = payload?.[0]?.payload as (typeof slices)[number] | undefined;
                  if (!active || !s) return null;
                  return (
                    <TooltipBox
                      title={s.name}
                      rows={[
                        {
                          label: formatPercent(s.pct, undefined, locale),
                          color: s.color,
                          value: money(s.display),
                        },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-muted-foreground">{tr('Total')}</span>
            <span className="text-sm font-semibold tabular">
              {money(total, { compact: Number(total) >= 100_000 })}
            </span>
          </div>
        </div>
        <ul className="min-w-0 space-y-2.5">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="text-xs text-muted-foreground tabular">
                {formatPercent(s.pct, undefined, locale)}
              </span>
              <span className="shrink-0 text-right font-medium tabular">{money(s.display)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
