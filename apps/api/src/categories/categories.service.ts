import type { Category as CategoryDto, TransactionType } from '@expense/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { toCategoryDto } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto';

const withCount = { _count: { select: { transactions: true } } } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, type?: TransactionType): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId, ...(type ? { type } : {}) },
      include: withCount,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    return categories.map(toCategoryDto);
  }

  /** Loads a category only if it belongs to the user; otherwise 404 (never 403, to avoid leaking ids). */
  async findOwned(userId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  /** Ensures a category exists, is owned by the user and matches the transaction type. */
  async assertUsable(userId: string, categoryId: string, type: TransactionType): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new BadRequestException('Category not found');
    if (category.type !== type) {
      throw new BadRequestException(
        `Category "${category.name}" is for ${category.type.toLowerCase()} transactions`,
      );
    }
    return category;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    try {
      const category = await this.prisma.category.create({
        data: { ...dto, userId },
        include: withCount,
      });
      return toCategoryDto(category);
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const category = await this.findOwned(userId, id);
    if (dto.type && dto.type !== category.type) {
      const usage = await this.usage(id);
      if (usage.transactions + usage.recurring + usage.budgets > 0) {
        throw new ConflictException('The type of a category that is in use cannot be changed');
      }
    }
    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: dto,
        include: withCount,
      });
      return toCategoryDto(updated);
    } catch (error) {
      throw this.mapUniqueError(error);
    }
  }

  /**
   * Deletes a category. If transactions or recurring schedules still use it, the caller must
   * name another category of the same type to move them to; otherwise 409 is returned.
   * Category budgets are removed with the category.
   */
  async remove(userId: string, id: string, reassignTo?: string): Promise<void> {
    const category = await this.findOwned(userId, id);
    const usage = await this.usage(id);
    const inUse = usage.transactions + usage.recurring > 0;

    if (inUse && !reassignTo) {
      throw new ConflictException({
        message: `"${category.name}" is used by ${usage.transactions} transaction(s) and ${usage.recurring} recurring schedule(s). Choose a category to move them to.`,
        details: usage,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (inUse && reassignTo) {
        if (reassignTo === id) throw new BadRequestException('Choose a different category');
        const target = await tx.category.findFirst({ where: { id: reassignTo, userId } });
        if (!target) throw new BadRequestException('Replacement category not found');
        if (target.type !== category.type) {
          throw new BadRequestException('Replacement category must have the same type');
        }
        await tx.transaction.updateMany({
          where: { categoryId: id, userId },
          data: { categoryId: target.id },
        });
        await tx.recurringTransaction.updateMany({
          where: { categoryId: id, userId },
          data: { categoryId: target.id },
        });
      }
      await tx.category.delete({ where: { id } });
    });
  }

  private async usage(categoryId: string) {
    const [transactions, recurring, budgets] = await Promise.all([
      this.prisma.transaction.count({ where: { categoryId } }),
      this.prisma.recurringTransaction.count({ where: { categoryId } }),
      this.prisma.budget.count({ where: { categoryId } }),
    ]);
    return { transactions, recurring, budgets };
  }

  private mapUniqueError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('You already have a category with this name and type');
    }
    return error;
  }
}
