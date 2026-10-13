import * as React from 'react';
import { ErrorState, LoadingSkeleton } from '@/components/common/states';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <div className={cn('flex-1 px-5 pt-4 pb-5', contentClassName)}>
        {loading ? (
          <LoadingSkeleton variant="chart" />
        ) : error ? (
          <ErrorState onRetry={onRetry} />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/** Legend rendered as HTML so it is readable, wraps on mobile and never relies on color alone. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; value?: React.ReactNode }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span>{item.label}</span>
          {item.value && <span className="font-medium text-foreground tabular">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}
