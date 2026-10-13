import type {
  RecurringExecution as RecurringExecutionDto,
  RecurringTransaction as RecurringDto,
} from '@expense/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Category, Prisma, RecurringTransaction } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import {
  dueOccurrences,
  firstOccurrenceOnOrAfter,
  nextOccurrenceAfter,
  Schedule,
} from '../common/finance/recurrence';
import { toMoney } from '../common/finance/money';
import { toCategorySummary } from '../common/mappers';
import {
  addDays,
  fromDbDate,
  maxDate,
  minDate,
  PlainDate,
  toDbDate,
  todayInTimeZone,
} from '../common/utils/plain-date';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';

/** Upper bound on occurrences generated for one schedule in a single pass. */
const MAX_OCCURRENCES_PER_RUN = 500;

type RecurringWithRelations = RecurringTransaction & {
  category: Category;
  _count?: { executions: number };
};

function scheduleOf(rt: RecurringTransaction): Schedule {
  return {
    frequency: rt.frequency,
    interval: rt.interval,
    startDate: fromDbDate(rt.startDate),
    endDate: rt.endDate ? fromDbDate(rt.endDate) : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
  ) {}

  async list(userId: string): Promise<RecurringDto[]> {
    const rows = await this.prisma.recurringTransaction.findMany({
      where: { userId },
      include: { category: true, _count: { select: { executions: true } } },
      orderBy: [
        { isActive: 'desc' },
        { nextRunDate: { sort: 'asc', nulls: 'last' } },
        { title: 'asc' },
      ],
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOne(userId: string, id: string): Promise<RecurringDto> {
    return this.toDto(await this.findOwned(userId, id));
  }

  async executions(userId: string, id: string): Promise<RecurringExecutionDto[]> {
    await this.findOwned(userId, id);
    const rows = await this.prisma.recurringExecution.findMany({
      where: { recurringTransactionId: id },
      orderBy: { scheduledDate: 'desc' },
      take: 100,
    });
    return rows.map((e) => ({
      id: e.id,
      scheduledDate: fromDbDate(e.scheduledDate),
      transactionId: e.transactionId,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async create(userId: string, dto: CreateRecurringDto): Promise<RecurringDto> {
    await this.categories.assertUsable(userId, dto.categoryId, dto.type);
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('End date must be on or after the start date');
    }

    const created = await this.prisma.recurringTransaction.create({
      data: {
        userId,
        title: dto.title,
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type,
        categoryId: dto.categoryId,
        paymentMethod: dto.paymentMethod ?? 'CASH',
        notes: dto.notes || null,
        tags: dto.tags ?? [],
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        startDate: toDbDate(dto.startDate),
        endDate: dto.endDate ? toDbDate(dto.endDate) : null,
        nextRunDate: toDbDate(dto.startDate),
      },
    });

    // Generate anything already due (start date today or in the past) straight away.
    const { today } = await this.users.today(userId);
    await this.processSchedule(created.id, today);
    return this.findOne(userId, created.id);
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto): Promise<RecurringDto> {
    const existing = await this.findOwned(userId, id);
    const type = dto.type ?? existing.type;
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (dto.type !== undefined || dto.categoryId !== undefined) {
      await this.categories.assertUsable(userId, categoryId, type);
    }

    const schedule: Schedule = {
      frequency: dto.frequency ?? existing.frequency,
      interval: dto.interval ?? existing.interval,
      startDate: dto.startDate ?? fromDbDate(existing.startDate),
      endDate: dto.endDate === undefined ? scheduleOf(existing).endDate : dto.endDate,
    };
    if (schedule.endDate && schedule.endDate < schedule.startDate) {
      throw new BadRequestException('End date must be on or after the start date');
    }

    const { today } = await this.users.today(userId);
    const isActive = dto.isActive ?? existing.isActive;
    const scheduleChanged =
      dto.frequency !== undefined ||
      dto.interval !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined;
    const resuming = dto.isActive === true && !existing.isActive;

    let nextRunDate = existing.nextRunDate ? fromDbDate(existing.nextRunDate) : null;
    if (scheduleChanged || resuming) {
      // Never re-generate dates already covered, and skip occurrences missed while paused.
      const lastRun = existing.lastRunDate ? addDays(fromDbDate(existing.lastRunDate), 1) : null;
      let from = lastRun ? maxDate(schedule.startDate, lastRun) : schedule.startDate;
      if (resuming) from = maxDate(from, today);
      nextRunDate = firstOccurrenceOnOrAfter(schedule, from);
    }

    await this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        type,
        categoryId,
        frequency: schedule.frequency,
        interval: schedule.interval,
        startDate: toDbDate(schedule.startDate),
        endDate: schedule.endDate ? toDbDate(schedule.endDate) : null,
        nextRunDate: nextRunDate ? toDbDate(nextRunDate) : null,
        isActive,
      },
    });

    if (isActive) await this.processSchedule(id, today);
    return this.findOne(userId, id);
  }

  pause(userId: string, id: string): Promise<RecurringDto> {
    return this.update(userId, id, { isActive: false });
  }

  resume(userId: string, id: string): Promise<RecurringDto> {
    return this.update(userId, id, { isActive: true });
  }

  /** Deletes the schedule. Transactions it already generated are kept. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.recurringTransaction.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Recurring transaction not found');
  }

  /** Processes all of one user's due schedules now. */
  async processDueForUser(userId: string): Promise<{ created: number }> {
    const { today } = await this.users.today(userId);
    const due = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true, nextRunDate: { lte: toDbDate(today) } },
      select: { id: true },
    });
    let created = 0;
    for (const { id } of due) created += await this.processSchedule(id, today);
    return { created };
  }

  /**
   * Scheduler entry point. Selects candidates whose next run is due in the earliest-ahead
   * time zone, then checks each against its owner's local "today".
   */
  async processAllDue(now: Date = new Date()): Promise<{ schedules: number; created: number }> {
    const horizon = addDays(todayInTimeZone('UTC', now), 1);
    const due = await this.prisma.recurringTransaction.findMany({
      where: { isActive: true, nextRunDate: { lte: toDbDate(horizon) } },
      select: { id: true, user: { select: { timezone: true } } },
    });
    let created = 0;
    for (const item of due) {
      try {
        created += await this.processSchedule(item.id, todayInTimeZone(item.user.timezone, now));
      } catch (error) {
        this.logger.error(
          `Failed to process recurring transaction ${item.id}`,
          (error as Error).stack,
        );
      }
    }
    return { schedules: due.length, created };
  }

  /**
   * Generates every occurrence from nextRunDate up to `today` (inclusive).
   *
   * Idempotency: each occurrence inserts a RecurringExecution row whose
   * (recurringTransactionId, scheduledDate) pair is unique, inside the same database
   * transaction as the generated Transaction. If two workers race, or a run is retried, the
   * second insert fails on the unique constraint, its transaction rolls back, and no
   * duplicate transaction is created.
   */
  async processSchedule(id: string, today: PlainDate): Promise<number> {
    const rt = await this.prisma.recurringTransaction.findUnique({ where: { id } });
    if (!rt || !rt.isActive || !rt.nextRunDate) return 0;

    const schedule = scheduleOf(rt);
    const from = fromDbDate(rt.nextRunDate);
    const until = schedule.endDate ? minDate(today, schedule.endDate) : today;
    const dates = dueOccurrences(schedule, from, until, MAX_OCCURRENCES_PER_RUN);
    if (dates.length === 0) return 0;

    let created = 0;
    for (const date of dates) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const execution = await tx.recurringExecution.create({
            data: { recurringTransactionId: rt.id, scheduledDate: toDbDate(date) },
          });
          const transaction = await tx.transaction.create({
            data: {
              userId: rt.userId,
              categoryId: rt.categoryId,
              title: rt.title,
              amount: rt.amount,
              type: rt.type,
              date: toDbDate(date),
              paymentMethod: rt.paymentMethod,
              notes: rt.notes,
              tags: rt.tags,
              recurringTransactionId: rt.id,
            },
          });
          await tx.recurringExecution.update({
            where: { id: execution.id },
            data: { transactionId: transaction.id },
          });
        });
        created++;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Already generated by another run: skip.
      }
    }

    const last = dates[dates.length - 1];
    const next = nextOccurrenceAfter(schedule, last);
    // Only advance if nobody else moved the pointer in the meantime.
    await this.prisma.recurringTransaction.updateMany({
      where: { id: rt.id, nextRunDate: rt.nextRunDate },
      data: { lastRunDate: toDbDate(last), nextRunDate: next ? toDbDate(next) : null },
    });
    if (created > 0) this.logger.log(`Generated ${created} transaction(s) for schedule ${rt.id}`);
    return created;
  }

  private async findOwned(userId: string, id: string): Promise<RecurringWithRelations> {
    const rt = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
      include: { category: true, _count: { select: { executions: true } } },
    });
    if (!rt) throw new NotFoundException('Recurring transaction not found');
    return rt;
  }

  private toDto(rt: RecurringWithRelations): RecurringDto {
    return {
      id: rt.id,
      title: rt.title,
      amount: toMoney(rt.amount),
      type: rt.type,
      paymentMethod: rt.paymentMethod,
      notes: rt.notes,
      tags: rt.tags,
      frequency: rt.frequency,
      interval: rt.interval,
      startDate: fromDbDate(rt.startDate),
      endDate: rt.endDate ? fromDbDate(rt.endDate) : null,
      nextRunDate: rt.nextRunDate ? fromDbDate(rt.nextRunDate) : null,
      lastRunDate: rt.lastRunDate ? fromDbDate(rt.lastRunDate) : null,
      isActive: rt.isActive,
      category: toCategorySummary(rt.category),
      executionCount: rt._count?.executions ?? 0,
      createdAt: rt.createdAt.toISOString(),
      updatedAt: rt.updatedAt.toISOString(),
    };
  }
}
