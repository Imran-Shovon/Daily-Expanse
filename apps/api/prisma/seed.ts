/**
 * Seeds a demo account with realistic data (default categories, ~4 months of transactions,
 * budgets and recurring schedules). Safe to re-run: only the demo user is replaced.
 *
 *   pnpm db:seed
 *
 * Demo login: demo@example.com / Demo1234
 */
import { PaymentMethod, Prisma, PrismaClient, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_CATEGORIES } from '@expense/shared';
import {
  addDays,
  addMonths,
  startOfMonth,
  toDbDate,
  todayInTimeZone,
} from '../src/common/utils/plain-date';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo1234';
const TIMEZONE = 'UTC';

/** Small deterministic PRNG so the seed produces the same data each run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261013);
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];
const amountBetween = (min: number, max: number) =>
  new Prisma.Decimal(Math.round((min + rand() * (max - min)) * 100)).div(100);

interface Template {
  category: string;
  titles: string[];
  min: number;
  max: number;
  perWeek: number;
  methods: PaymentMethod[];
  tags?: string[];
}

const EXPENSE_TEMPLATES: Template[] = [
  {
    category: 'Food & groceries',
    titles: [
      'Supermarket',
      'Farmers market',
      'Bakery',
      'Lunch with team',
      'Coffee',
      'Takeaway dinner',
    ],
    min: 4,
    max: 85,
    perWeek: 5,
    methods: ['DEBIT_CARD', 'CASH', 'MOBILE_PAYMENT'],
    tags: ['groceries', 'eating-out'],
  },
  {
    category: 'Transportation',
    titles: ['Fuel', 'Metro card top-up', 'Ride share', 'Parking'],
    min: 3,
    max: 60,
    perWeek: 2.5,
    methods: ['DEBIT_CARD', 'MOBILE_PAYMENT'],
    tags: ['commute'],
  },
  {
    category: 'Shopping',
    titles: ['Clothing store', 'Online order', 'Home supplies', 'Electronics accessory'],
    min: 12,
    max: 140,
    perWeek: 0.8,
    methods: ['CREDIT_CARD'],
  },
  {
    category: 'Entertainment',
    titles: ['Cinema', 'Concert tickets', 'Board game cafe', 'Bowling'],
    min: 8,
    max: 70,
    perWeek: 0.6,
    methods: ['CREDIT_CARD', 'MOBILE_PAYMENT'],
    tags: ['weekend'],
  },
  {
    category: 'Healthcare',
    titles: ['Pharmacy', 'Doctor visit', 'Dental check-up'],
    min: 10,
    max: 120,
    perWeek: 0.3,
    methods: ['DEBIT_CARD'],
  },
  {
    category: 'Personal care',
    titles: ['Haircut', 'Toiletries'],
    min: 6,
    max: 40,
    perWeek: 0.4,
    methods: ['CASH', 'DEBIT_CARD'],
  },
];

async function main() {
  const today = todayInTimeZone(TIMEZONE);
  const firstMonth = addMonths(startOfMonth(today), -3);

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      currency: 'BDT',
      timezone: TIMEZONE,
    },
  });

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: user.id, isDefault: true })),
  });
  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const cat = (name: string) => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Missing category ${name}`);
    return found.id;
  };

  const transactions: Prisma.TransactionCreateManyInput[] = [];
  const add = (
    title: string,
    type: TransactionType,
    category: string,
    amount: Prisma.Decimal,
    date: string,
    paymentMethod: PaymentMethod,
    tags: string[] = [],
    notes: string | null = null,
  ) =>
    transactions.push({
      userId: user.id,
      title,
      type,
      categoryId: cat(category),
      amount,
      date: toDbDate(date),
      paymentMethod,
      tags,
      notes,
    });

  // Monthly fixed items
  for (let month = firstMonth; month <= today; month = addMonths(month, 1)) {
    const on = (day: number) => addDays(month, day - 1);
    if (on(1) <= today)
      add(
        'Monthly salary',
        'INCOME',
        'Salary',
        new Prisma.Decimal('4200.00'),
        on(1),
        'BANK_TRANSFER',
      );
    if (on(2) <= today)
      add(
        'Apartment rent',
        'EXPENSE',
        'Housing & rent',
        new Prisma.Decimal('1350.00'),
        on(2),
        'BANK_TRANSFER',
        ['home'],
      );
    if (on(8) <= today)
      add(
        'Electricity bill',
        'EXPENSE',
        'Utilities & bills',
        amountBetween(55, 95),
        on(8),
        'BANK_TRANSFER',
        ['bills'],
      );
    if (on(10) <= today)
      add(
        'Internet',
        'EXPENSE',
        'Utilities & bills',
        new Prisma.Decimal('45.00'),
        on(10),
        'CREDIT_CARD',
        ['bills'],
      );
    if (on(12) <= today)
      add(
        'Gym membership',
        'EXPENSE',
        'Personal care',
        new Prisma.Decimal('39.00'),
        on(12),
        'CREDIT_CARD',
      );
    if (on(15) <= today && rand() > 0.3) {
      add(
        'Freelance design project',
        'INCOME',
        'Freelance',
        amountBetween(300, 900),
        on(15),
        'BANK_TRANSFER',
        ['side-project'],
      );
    }
    if (on(20) <= today && rand() > 0.5) {
      add('Online course', 'EXPENSE', 'Education', amountBetween(20, 120), on(20), 'CREDIT_CARD', [
        'learning',
      ]);
    }
    if (on(25) <= today)
      add(
        'Dividend payout',
        'INCOME',
        'Investments',
        amountBetween(15, 60),
        on(25),
        'BANK_TRANSFER',
      );
  }

  // Variable daily spending
  for (let day = firstMonth; day <= today; day = addDays(day, 1)) {
    for (const template of EXPENSE_TEMPLATES) {
      const expected = template.perWeek / 7;
      if (rand() < expected) {
        add(
          pick(template.titles),
          'EXPENSE',
          template.category,
          amountBetween(template.min, template.max),
          day,
          pick(template.methods),
          template.tags && rand() > 0.5 ? [pick(template.tags)] : [],
        );
      }
    }
  }
  add(
    'Weekend trip',
    'EXPENSE',
    'Travel',
    new Prisma.Decimal('486.40'),
    addDays(firstMonth, 40),
    'CREDIT_CARD',
    ['vacation'],
    'Train tickets and two nights in a guesthouse',
  );
  add(
    'Birthday gift from family',
    'INCOME',
    'Gifts',
    new Prisma.Decimal('150.00'),
    addDays(firstMonth, 55),
    'CASH',
  );

  await prisma.transaction.createMany({ data: transactions });

  // Budgets
  const monthStart = startOfMonth(firstMonth);
  await prisma.budget.createMany({
    data: [
      {
        userId: user.id,
        name: 'Monthly spending',
        amount: new Prisma.Decimal('2600.00'),
        period: 'MONTHLY',
        startDate: toDbDate(monthStart),
      },
      {
        userId: user.id,
        categoryId: cat('Food & groceries'),
        amount: new Prisma.Decimal('450.00'),
        period: 'MONTHLY',
        startDate: toDbDate(monthStart),
      },
      {
        userId: user.id,
        categoryId: cat('Entertainment'),
        amount: new Prisma.Decimal('90.00'),
        period: 'MONTHLY',
        startDate: toDbDate(monthStart),
      },
      {
        userId: user.id,
        categoryId: cat('Shopping'),
        amount: new Prisma.Decimal('200.00'),
        period: 'MONTHLY',
        startDate: toDbDate(monthStart),
      },
      {
        userId: user.id,
        categoryId: cat('Transportation'),
        amount: new Prisma.Decimal('160.00'),
        period: 'MONTHLY',
        startDate: toDbDate(monthStart),
      },
    ],
  });

  // Recurring schedules (future-dated so the seed does not depend on the scheduler)
  const nextMonth = addMonths(startOfMonth(today), 1);
  await prisma.recurringTransaction.createMany({
    data: [
      {
        userId: user.id,
        title: 'Streaming subscription',
        amount: new Prisma.Decimal('15.99'),
        type: 'EXPENSE',
        categoryId: cat('Subscriptions'),
        paymentMethod: 'CREDIT_CARD',
        frequency: 'MONTHLY',
        interval: 1,
        startDate: toDbDate(addDays(nextMonth, 4)),
        nextRunDate: toDbDate(addDays(nextMonth, 4)),
        tags: ['subscription'],
      },
      {
        userId: user.id,
        title: 'Monthly salary',
        amount: new Prisma.Decimal('4200.00'),
        type: 'INCOME',
        categoryId: cat('Salary'),
        paymentMethod: 'BANK_TRANSFER',
        frequency: 'MONTHLY',
        interval: 1,
        startDate: toDbDate(nextMonth),
        nextRunDate: toDbDate(nextMonth),
      },
      {
        userId: user.id,
        title: 'Cloud storage',
        amount: new Prisma.Decimal('99.00'),
        type: 'EXPENSE',
        categoryId: cat('Subscriptions'),
        paymentMethod: 'CREDIT_CARD',
        frequency: 'YEARLY',
        interval: 1,
        startDate: toDbDate(addMonths(today, 2)),
        nextRunDate: toDbDate(addMonths(today, 2)),
        isActive: false,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD} with ${transactions.length} transactions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
