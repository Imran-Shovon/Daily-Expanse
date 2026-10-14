'use client';

import { useLanguage } from '@/lib/i18n/language-provider';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-muted/50 text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong while loading this data.',
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t: tr } = useLanguage();
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-sm text-muted-foreground">{tr(message)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {tr('Try again')}{' '}
        </Button>
      )}
    </div>
  );
}

/** Generic skeletons sized like the content they stand in for. */
export function LoadingSkeleton({
  variant,
  rows = 5,
}: {
  variant: 'table' | 'cards' | 'chart' | 'list';
  rows?: number;
}) {
  const { t: tr } = useLanguage();
  if (variant === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
            <Skeleton className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'chart') {
    return (
      <div className="flex h-64 items-end gap-2 px-2 pb-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
    );
  }
  return (
    <div className="divide-y" aria-busy="true" aria-label={tr('Loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
