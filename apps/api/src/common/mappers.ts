import type {
  Category as CategoryDto,
  CategorySummary,
  DateFormat,
  DateRangePreset,
  PaymentMethod,
  Theme,
  Transaction as TransactionDto,
  User as UserDto,
} from '@expense/shared';
import type { Category, Transaction, User } from '@prisma/client';
import { toMoney } from './finance/money';
import { fromDbDate } from './utils/plain-date';

/** Never include passwordHash or other secrets here. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    currency: user.currency,
    timezone: user.timezone,
    dateFormat: user.dateFormat as DateFormat,
    theme: user.theme as Theme,
    defaultDateRange: user.defaultDateRange as DateRangePreset,
    hasPassword: user.passwordHash !== null,
    googleLinked: user.googleId !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toCategorySummary(category: Category): CategorySummary {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
  };
}

export function toCategoryDto(
  category: Category & { _count?: { transactions: number } },
): CategoryDto {
  return {
    ...toCategorySummary(category),
    isDefault: category.isDefault,
    transactionCount: category._count?.transactions ?? 0,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export type TransactionWithCategory = Transaction & { category: Category };

export function toTransactionDto(tx: TransactionWithCategory): TransactionDto {
  return {
    id: tx.id,
    title: tx.title,
    amount: toMoney(tx.amount),
    type: tx.type,
    date: fromDbDate(tx.date),
    paymentMethod: tx.paymentMethod as PaymentMethod,
    notes: tx.notes,
    tags: tx.tags,
    category: toCategorySummary(tx.category),
    recurringTransactionId: tx.recurringTransactionId,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  };
}
