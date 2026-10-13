import { MONEY_REGEX } from '@expense/shared';
import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidPlainDate, isValidTimeZone } from '../utils/plain-date';

/** Calendar date in YYYY-MM-DD form that actually exists. */
export function IsPlainDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPlainDate',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid date (YYYY-MM-DD)`, ...options },
      validator: { validate: (value: unknown) => isValidPlainDate(value) },
    });
}

/**
 * Positive monetary amount with at most 2 decimals, sent as a string or number.
 * Numbers are converted to strings before validation so they never pass through float math.
 */
export function IsMoney(options?: ValidationOptions & { allowZero?: boolean }) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isMoney',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a positive amount with at most 2 decimal places`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string' || !MONEY_REGEX.test(value)) return false;
          return options?.allowZero ? true : Number(value) > 0;
        },
      },
    });
}

export const MoneyTransform = () =>
  Transform(({ value }) => (typeof value === 'number' ? String(value) : value));

export function IsTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid IANA time zone`, ...options },
      validator: { validate: (value: unknown) => isValidTimeZone(value) },
    });
}

export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const ToLowerCase = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Normalises tags: trimmed, lowercase, de-duplicated, empty values removed. */
export const NormalizeTags = () =>
  Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    const tags = value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    return [...new Set(tags)];
  });
