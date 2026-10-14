'use client';

import { useLanguage } from '@/lib/i18n/language-provider';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function SummaryCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'neutral',
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  tone?: 'neutral' | 'income' | 'expense' | 'accent';
  loading?: boolean;
  className?: string;
}) {
  const { t: tr } = useLanguage();
  const toneClass = {
    neutral: 'bg-muted text-muted-foreground',
    income: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    expense: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    accent: 'bg-accent text-accent-foreground',
  }[tone];

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{tr(label)}</p>
        <span
          className={cn('flex size-8 items-center justify-center rounded-lg', toneClass)}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-3.5 w-24" />
        </>
      ) : (
        <>
          <p className="mt-2 text-[26px] leading-tight font-semibold tracking-tight">{value}</p>
          {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
        </>
      )}
    </Card>
  );
}
