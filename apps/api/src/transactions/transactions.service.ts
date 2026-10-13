import type { Paginated, Transaction as TransactionDto } from '@expense/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { toTransactionDto } from '../common/mappers';
import { DateRangeError, resolveDateRange } from '../common/utils/date-range';
import { toDbDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  CreateTransactionDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './dto/transactions.dto';

export type TransactionFilters = Omit<
  ListTransactionsQueryDto,
  'page' | 'pageSize' | 'sortBy' | 'sortOrder'
>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
  ) {}

  /** Builds a where clause that is always scoped to the user. */
  async buildWhere(
    userId: string,
    filters: TransactionFilters,
  ): Promise<Prisma.TransactionWhereInput> {
    let from = filters.from;
    let to = filters.to;
    if (filters.range && filters.range !== 'custom') {
      const { today } = await this.users.today(userId);
      ({ from, to } = resolveDateRange(filters.range, today));
    } else if (from && to && from > to) {
      throw new BadRequestException('"from" must be on or before "to"');
    }

    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.type) where.type = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
    if (filters.tag) where.tags = { has: filters.tag.toLowerCase() };
    if (from || to) {
      where.date = {
        ...(from ? { gte: toDbDate(from) } : {}),
        ...(to ? { lte: toDbDate(to) } : {}),
      };
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async list(userId: string, query: ListTransactionsQueryDto): Promise<Paginated<TransactionDto>> {
    const where = await this.buildWhere(userId, query).catch((error) => {
      if (error instanceof DateRangeError) throw new BadRequestException(error.message);
      throw error;
    });
    const { page, pageSize, sortBy, sortOrder } = query;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { category: true },
        // Secondary keys give a stable order so pages never repeat or skip rows.
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { data: rows.map(toTransactionDto), meta: paginationMeta(page, pageSize, total) };
  }

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return toTransactionDto(tx);
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    await this.categories.assertUsable(userId, dto.categoryId, dto.type);
    const tx = await this.prisma.transaction.create({
      data: {
        userId,
        title: dto.title,
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type,
        categoryId: dto.categoryId,
        date: toDbDate(dto.date),
        paymentMethod: dto.paymentMethod ?? 'CASH',
        notes: dto.notes || null,
        tags: dto.tags ?? [],
      },
      include: { category: true },
    });
    return toTransactionDto(tx);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    const existing = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Transaction not found');

    const type = dto.type ?? existing.type;
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.categories.assertUsable(userId, categoryId, type);
    }

    const tx = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.date !== undefined ? { date: toDbDate(dto.date) } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        type,
        categoryId,
      },
      include: { category: true },
    });
    return toTransactionDto(tx);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.transaction.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Transaction not found');
  }
}
