import { DEFAULT_CATEGORIES } from '@expense/shared';
import type { Prisma } from '@prisma/client';

/** Seeds the standard income and expense categories for a new user. */
export async function createDefaultCategories(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId, isDefault: true })),
    skipDuplicates: true,
  });
}
