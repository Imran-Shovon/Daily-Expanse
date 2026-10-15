'use client';

import * as React from 'react';
import { useLanguage } from '@/lib/i18n/language-provider';
import { cn } from '@/lib/utils';

const MESSAGES = [
  'Securing your session…',
  'Tallying your transactions…',
  'Balancing your budgets…',
  'Preparing your dashboard…',
];

/** Matches the 2.4s loader cycle so each message lands on a fresh trend-line draw. */
const MESSAGE_INTERVAL_MS = 2400;

const COINS = [
  { left: '18%', delay: '0s' },
  { left: '78%', delay: '0.8s' },
  { left: '50%', delay: '1.6s' },
];

/** Branded full-page loader: the logo's trend line draws itself inside a spinning ring. */
export function BrandLoader({ className }: { className?: string }) {
  const { t: tr } = useLanguage();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % MESSAGES.length),
      MESSAGE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_60%)]"
      />

      <div className="loader-enter relative flex flex-col items-center">
        <div className="relative flex size-28 items-center justify-center" aria-hidden>
          <div className="loader-glow absolute inset-2 rounded-full blur-xl" />
          <div className="loader-ring absolute inset-0 rounded-full" />

          {COINS.map((coin) => (
            <span
              key={coin.left}
              className="loader-coin absolute bottom-6 size-1.5 rounded-full bg-primary"
              style={{ left: coin.left, animationDelay: coin.delay }}
            />
          ))}

          <div className="relative flex size-16 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <svg
              viewBox="0 0 24 24"
              className="size-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M4 17l5-5 4 4 7-8"
                pathLength={1}
                className="loader-path"
                strokeDashoffset={1}
              />
              <path
                d="M15 8h5v5"
                pathLength={1}
                className="loader-path loader-path-head"
                strokeDashoffset={1}
              />
            </svg>
          </div>
        </div>

        <p className="mt-8 text-lg font-semibold tracking-tight">{tr('Daily Expense')}</p>

        <p className="mt-1.5 h-5 text-sm text-muted-foreground">
          <span key={index} className="loader-message inline-block">
            {tr(MESSAGES[index]!)}
          </span>
        </p>

        <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="loader-sweep h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <span className="sr-only">{tr('Loading')}</span>
      </div>
    </div>
  );
}
