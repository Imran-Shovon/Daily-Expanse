'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  DATE_RANGE_PRESET_LABELS,
  DATE_RANGE_PRESETS,
  type DateRangePreset,
} from '@expense/shared';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Popover as PopoverPrimitive } from 'radix-ui';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RangeParams } from '@/lib/api/endpoints';
import { useUser } from '@/lib/auth/auth-provider';
import { formatDate, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date range state stored in the URL (?range=this_month or ?from=...&to=...), so a filtered
 * view survives reloads and can be bookmarked. Defaults to the user's preferred range.
 */
export function useDateRangeParams(): [RangeParams, (next: RangeParams | null) => void];
export function useDateRangeParams(options: {
  allowAll: true;
}): [RangeParams | null, (next: RangeParams | null) => void];
export function useDateRangeParams(options?: {
  allowAll?: boolean;
}): [RangeParams | null, (next: RangeParams | null) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();

  const allowAll = options?.allowAll ?? false;
  const value = React.useMemo<RangeParams | null>(() => {
    const range = searchParams.get('range');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from && to && ISO.test(from) && ISO.test(to)) return { range: 'custom', from, to };
    if (range && (DATE_RANGE_PRESETS as readonly string[]).includes(range) && range !== 'custom') {
      return { range: range as DateRangePreset };
    }
    if (allowAll) return null;
    return { range: user.defaultDateRange === 'custom' ? 'this_month' : user.defaultDateRange };
  }, [searchParams, user.defaultDateRange, allowAll]);

  const setValue = React.useCallback(
    (next: RangeParams | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('range');
      params.delete('from');
      params.delete('to');
      params.delete('page');
      if (!next) {
        // all dates: no range params
      } else if (next.range === 'custom' && next.from && next.to) {
        params.set('from', next.from);
        params.set('to', next.to);
      } else if (next.range !== 'custom') {
        params.set('range', next.range);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [value, setValue];
}

export function rangeLabel(value: RangeParams | null, dateFormat: string, locale?: string) {
  if (!value) return 'All dates';
  if (value.range === 'custom' && value.from && value.to) {
    return value.from === value.to
      ? formatDate(value.from, dateFormat, locale)
      : `${formatDate(value.from, dateFormat, locale)} – ${formatDate(value.to, dateFormat, locale)}`;
  }
  return DATE_RANGE_PRESET_LABELS[value.range];
}

export function DateRangeFilter({
  value,
  onChange,
  allowAll = false,
  className,
}: {
  value: RangeParams | null;
  onChange: (next: RangeParams | null) => void;
  allowAll?: boolean;
  className?: string;
}) {
  const { t: tr, locale } = useLanguage();
  const user = useUser();
  const [open, setOpen] = React.useState(false);
  const today = todayIn(user.timezone);
  const [from, setFrom] = React.useState(value?.from ?? today);
  const [to, setTo] = React.useState(value?.to ?? today);
  const invalid = !from || !to || from > to;

  const handleOpenChange = (next: boolean) => {
    if (next && value?.range === 'custom') {
      setFrom(value.from ?? today);
      setTo(value.to ?? today);
    }
    setOpen(next);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="outline"
          className={cn('justify-between gap-2 font-normal', className)}
          aria-label={tr('Date range')}
        >
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{tr(rangeLabel(value, user.dateFormat, locale))}</span>
          <ChevronDown className="ml-1 text-muted-foreground" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div role="listbox" aria-label={tr('Preset ranges')}>
            {allowAll && (
              <button
                role="option"
                aria-selected={value === null}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                  value === null && 'font-medium',
                )}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {tr('All dates')}{' '}
                {value === null && <Check className="size-4 text-primary" strokeWidth={2.5} />}
              </button>
            )}
            {DATE_RANGE_PRESETS.filter((p) => p !== 'custom').map((preset) => {
              const selected = value?.range === preset;
              return (
                <button
                  key={preset}
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
                    selected && 'font-medium',
                  )}
                  onClick={() => {
                    onChange({ range: preset });
                    setOpen(false);
                  }}
                >
                  {tr(DATE_RANGE_PRESET_LABELS[preset])}
                  {selected && <Check className="size-4 text-primary" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
          <form
            className="mt-1.5 space-y-3 border-t px-2.5 pt-3 pb-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (invalid) return;
              onChange({ range: 'custom', from, to });
              setOpen(false);
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">{tr('Custom range')}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="range-from" className="text-xs">
                  {tr('From')}{' '}
                </Label>
                <Input
                  id="range-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 px-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="range-to" className="text-xs">
                  {tr('To')}{' '}
                </Label>
                <Input
                  id="range-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 px-2 text-xs"
                />
              </div>
            </div>
            {from && to && from > to && (
              <p className="text-xs text-destructive">
                {tr('Start date must be before end date.')}
              </p>
            )}
            <Button type="submit" size="sm" className="w-full" disabled={invalid}>
              {tr('Apply range')}{' '}
            </Button>
          </form>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
