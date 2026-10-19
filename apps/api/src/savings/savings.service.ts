import type {
  Paginated,
  SavingsEntry as SavingsEntryDto,
  SavingsEntryType,
  SavingsSummary,
} from '@expense/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginationMeta } from '../common/dto/pagination.dto';
import { toMoney, ZERO } from '../common/finance/money';
import { fromDbDate, startOfMonth, toDbDate } from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateSavingsEntryDto, SavingsEntriesQueryDto } from './dto/savings.dto';
import { chronological, savingsBalance } from './savings-math';

interface EntryRow {
  id: string;
  type: SavingsEntryType;
  amount: Prisma.Decimal;
  date: Date;
  source: string | null;
  purpose: string | null;
  notes: string | null;
  createdAt: Date;
  balanceAfter: Prisma.Decimal;
}

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async summary(userId: string): Promise<SavingsSummary> {
    const { today } = await this.users.today(userId);
    const [all, month] = await Promise.all([
      this.prisma.savingsEntry.groupBy({
        by: ['type'],
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.savingsEntry.groupBy({
        by: ['type'],
        where: { userId, date: { gte: toDbDate(startOfMonth(today)), lte: toDbDate(today) } },
        _sum: { amount: true },
      }),
    ]);
    const sum = (rows: typeof month, type: SavingsEntryType) =>
      rows.find((r) => r.type === type)?._sum.amount ?? ZERO;
    const added = sum(all, 'DEPOSIT');
    const takenOut = sum(all, 'WITHDRAWAL');

    return {
      balance: toMoney(added.minus(takenOut)),
      totalAdded: toMoney(added),
      totalTakenOut: toMoney(takenOut),
      thisMonth: {
        added: toMoney(sum(month, 'DEPOSIT')),
        takenOut: toMoney(sum(month, 'WITHDRAWAL')),
      },
      entryCount: all.reduce((n, r) => n + r._count, 0),
    };
  }

  /** History, newest first, each entry with the balance right after it. */
  async entries(
    userId: string,
    query: SavingsEntriesQueryDto,
  ): Promise<Paginated<SavingsEntryDto>> {
    const { page, pageSize, type } = query;
    const typeFilter = type ? Prisma.sql`WHERE type::text = ${type}` : Prisma.empty;
    // The running balance is computed over every entry before the type filter applies,
    // so filtered rows still show the real balance at that point.
    const [rows, total] = await Promise.all([
      this.prisma.$queryRaw<EntryRow[]>`
        SELECT * FROM (
          SELECT id, type, amount, date, source, purpose, notes, "createdAt",
            SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE -amount END)
              OVER (ORDER BY date, "createdAt", id) AS "balanceAfter"
          FROM savings_entries
          WHERE "userId" = ${userId}
        ) history
        ${typeFilter}
        ORDER BY date DESC, "createdAt" DESC, id DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.savingsEntry.count({ where: { userId, ...(type ? { type } : {}) } }),
    ]);
    return { data: rows.map(toEntryDto), meta: paginationMeta(page, pageSize, total) };
  }

  async addEntry(userId: string, dto: CreateSavingsEntryDto): Promise<SavingsEntryDto> {
    const { today } = await this.users.today(userId);
    const date = dto.date ?? today;
    if (date > today) {
      throw new BadRequestException('Savings entries cannot be dated in the future');
    }
    const amount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      // Locking the user row serialises concurrent entries so the balance never goes below zero.
      // Only the current balance limits a withdrawal; its date can be any day up to today.
      const existing = await lockAndLoadEntries(tx, userId);

      if (dto.type === 'WITHDRAWAL') {
        const balance = savingsBalance(existing);
        if (amount.gt(balance)) {
          throw new BadRequestException(
            `You can take out at most the ${toMoney(balance)} in your savings`,
          );
        }
      }

      const created = await tx.savingsEntry.create({
        data: {
          userId,
          type: dto.type,
          amount,
          date: toDbDate(date),
          // Keep only the field that matches the direction of the money.
          source: dto.type === 'DEPOSIT' ? dto.source : null,
          purpose: dto.type === 'WITHDRAWAL' ? dto.purpose : null,
          notes: dto.notes || null,
        },
      });
      const history = chronological([...existing, { ...created, date }]);
      const upToNew = history.slice(0, history.findIndex((e) => e.id === created.id) + 1);
      return toEntryDto({ ...created, balanceAfter: savingsBalance(upToNew) });
    });
  }

  async removeEntry(userId: string, entryId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const entries = await lockAndLoadEntries(tx, userId);
      if (!entries.some((e) => e.id === entryId)) {
        throw new NotFoundException('Savings entry not found');
      }
      if (savingsBalance(entries.filter((e) => e.id !== entryId)).lt(0)) {
        throw new BadRequestException(
          'Removing this would leave your savings below zero. Remove a withdrawal first.',
        );
      }
      await tx.savingsEntry.delete({ where: { id: entryId } });
    });
  }
}

async function lockAndLoadEntries(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  const rows = await tx.savingsEntry.findMany({
    where: { userId },
    select: { id: true, type: true, amount: true, date: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, date: fromDbDate(r.date) }));
}

function toEntryDto(row: EntryRow): SavingsEntryDto {
  return {
    id: row.id,
    type: row.type,
    amount: toMoney(row.amount),
    date: fromDbDate(row.date),
    source: row.source,
    purpose: row.purpose,
    notes: row.notes,
    balanceAfter: toMoney(row.balanceAfter),
    createdAt: row.createdAt.toISOString(),
  };
}
