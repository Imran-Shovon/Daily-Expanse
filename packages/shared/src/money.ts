/**
 * Formatting helpers for display only. Never use these for arithmetic:
 * all financial calculations happen server-side with decimal types.
 */
export function formatMoney(amount: string | number, currency: string, locale?: string): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

/** Positive amount with up to 2 decimal places and at most 12 integer digits. */
export const MONEY_REGEX = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

/** Calendar date in ISO form, e.g. 2026-10-13. */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
