/**
 * Display formatting. Pure functions with no imports so they can be unit tested with
 * `node --test`. Never use these results for arithmetic - money math happens server-side.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMoney(
  amount: string | number,
  currency: string,
  opts: { compact?: boolean; signed?: boolean } = {},
  locale?: string,
): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      minimumFractionDigits: opts.compact ? 0 : 2,
      maximumFractionDigits: opts.compact ? 1 : 2,
      signDisplay: opts.signed ? 'exceptZero' : 'auto',
    }).format(safe);
    return formatted;
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/** Formats an ISO calendar date (YYYY-MM-DD) with a user date-format pattern. */
export function formatDate(
  isoDate: string,
  pattern: string = 'MMM d, yyyy',
  locale?: string,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, y, m, d] = match;
  const monthIndex = Number(m) - 1;
  const formatted = pattern.replace(/yyyy|MMM|MM|dd|d/g, (token) => {
    switch (token) {
      case 'yyyy':
        return y;
      case 'MMM':
        if (locale?.startsWith('bn') && monthIndex >= 0 && monthIndex < 12) {
          return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
            new Date(Date.UTC(2024, monthIndex, 1)),
          );
        }
        return MONTHS[monthIndex] ?? m;
      case 'MM':
        return m;
      case 'dd':
        return d;
      case 'd':
        return String(Number(d));
      default:
        return token;
    }
  });
  return locale?.startsWith('bn')
    ? formatted.replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]!)
    : formatted;
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
  locale?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = `${value.toFixed(digits).replace(/\.0+$/, '')}%`;
  return locale?.startsWith('bn')
    ? formatted.replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]!)
    : formatted;
}

/** Today's ISO date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Validates "12", "12.5", "12.50"; up to 12 integer digits and 2 decimals, > 0. */
export function isValidAmount(value: string): boolean {
  return /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}
