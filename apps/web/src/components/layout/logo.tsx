'use client';

import { useLanguage } from '@/lib/i18n/language-provider';
import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  const { t: tr } = useLanguage();
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 17l5-5 4 4 7-8" />
          <path d="M15 8h5v5" />
        </svg>
      </span>
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight">{tr('Daily Expense')}</span>
      )}
    </span>
  );
}
