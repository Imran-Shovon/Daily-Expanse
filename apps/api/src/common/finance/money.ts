import { Prisma } from '@prisma/client';

/**
 * Arbitrary-precision decimal used for every money calculation (decimal.js under the hood,
 * the same type Prisma returns for NUMERIC columns). Never use JS numbers for money math.
 */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

export type DecimalLike = Decimal | string | number | null | undefined;

export function toDecimal(value: DecimalLike): Decimal {
  if (value === null || value === undefined) return ZERO;
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Serializes money for the API: fixed 2 decimal places, half-up rounding. */
export function toMoney(value: DecimalLike): string {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function sumMoney(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), ZERO);
}

/**
 * part / whole * 100, rounded to one decimal place.
 * Returns null when the whole is zero or negative (no division by zero).
 */
export function percentage(part: DecimalLike, whole: DecimalLike): number | null {
  const denominator = toDecimal(whole);
  if (denominator.lte(0)) return null;
  return toDecimal(part)
    .div(denominator)
    .times(HUNDRED)
    .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
    .toNumber();
}
