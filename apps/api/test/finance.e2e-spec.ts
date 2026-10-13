import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayInTimeZone } from '../src/common/utils/plain-date';
import { PrismaService } from '../src/prisma/prisma.service';
import { RecurringService } from '../src/recurring/recurring.service';
import { API, categoryId, createTestApp, registerUser, resetDatabase, TestUser } from './utils';

describe('Budgets, dashboard, reports & recurring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const add = (user: TestUser, body: Record<string, unknown>) =>
    http.post(`${API}/transactions`).set(user.auth).send(body).expect(201);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('dashboard summary', () => {
    let user: TestUser;
    let other: TestUser;

    beforeAll(async () => {
      user = await registerUser(app);
      other = await registerUser(app);
      const food = categoryId(user, 'Food & groceries');
      const rent = categoryId(user, 'Housing & rent');
      const salary = categoryId(user, 'Salary');
      await add(user, {
        title: 'Salary',
        amount: '4000.00',
        type: 'INCOME',
        categoryId: salary,
        date: '2025-03-01',
      });
      await add(user, {
        title: 'Rent',
        amount: '1500.00',
        type: 'EXPENSE',
        categoryId: rent,
        date: '2025-03-02',
      });
      await add(user, {
        title: 'Food',
        amount: '499.99',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-03-31',
      });
      await add(user, {
        title: 'Old',
        amount: '100.00',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-02-28',
      });
      await add(user, {
        title: 'Next',
        amount: '75.00',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-04-01',
      });
      // Another user's data must never leak into these totals.
      await add(other, {
        title: 'X',
        amount: '999.00',
        type: 'EXPENSE',
        categoryId: categoryId(other, 'Shopping'),
        date: '2025-03-15',
      });
    });

    it('computes period totals, net and savings rate from real records', async () => {
      const res = await http
        .get(`${API}/dashboard/summary?from=2025-03-01&to=2025-03-31`)
        .set(user.auth)
        .expect(200);
      expect(res.body).toMatchObject({
        range: { from: '2025-03-01', to: '2025-03-31' },
        totalIncome: '4000.00',
        totalExpenses: '1999.99',
        netBalance: '2000.01',
        savingsRate: 50,
        transactionCount: 3,
      });
      // Cumulative balance includes earlier history up to the end of the range.
      expect(res.body.cumulativeBalance).toBe('1900.01');
      expect(res.body.recentTransactions).toHaveLength(3);
    });

    it('returns null savings rate without income and zeros for empty ranges', async () => {
      const res = await http
        .get(`${API}/dashboard/summary?from=2025-04-01&to=2025-04-30`)
        .set(user.auth)
        .expect(200);
      expect(res.body).toMatchObject({
        totalIncome: '0.00',
        totalExpenses: '75.00',
        savingsRate: null,
      });

      const empty = await http
        .get(`${API}/dashboard/summary?from=2001-01-01&to=2001-01-31`)
        .set(user.auth)
        .expect(200);
      expect(empty.body).toMatchObject({
        totalIncome: '0.00',
        totalExpenses: '0.00',
        netBalance: '0.00',
        savingsRate: null,
      });
    });

    it('validates date range parameters', async () => {
      await http.get(`${API}/dashboard/summary?range=custom`).set(user.auth).expect(400);
      await http.get(`${API}/dashboard/summary?range=yesterday`).set(user.auth).expect(400);
      await http
        .get(`${API}/dashboard/summary?from=2025-03-31&to=2025-03-01`)
        .set(user.auth)
        .expect(400);
    });

    it('builds category breakdown and trends without double counting', async () => {
      const breakdown = await http
        .get(`${API}/dashboard/category-breakdown?from=2025-03-01&to=2025-03-31`)
        .set(user.auth)
        .expect(200);
      expect(breakdown.body.total).toBe('1999.99');
      expect(
        breakdown.body.items.map((i: { category: { name: string }; total: string }) => [
          i.category.name,
          i.total,
        ]),
      ).toEqual([
        ['Housing & rent', '1500.00'],
        ['Food & groceries', '499.99'],
      ]);
      expect(breakdown.body.items[0].percentage).toBe(75);

      const trends = await http
        .get(`${API}/dashboard/spending-trends?from=2025-03-01&to=2025-03-31&granularity=day`)
        .set(user.auth)
        .expect(200);
      expect(trends.body.points).toHaveLength(31);
      const total = trends.body.points.reduce(
        (s: number, p: { expenses: string }) => s + Math.round(Number(p.expenses) * 100),
        0,
      );
      expect(total).toBe(199999);
    });

    it('resolves presets using the user time zone', async () => {
      const kiri = await registerUser(app, { timezone: 'Pacific/Kiritimati' }); // UTC+14
      const res = await http.get(`${API}/dashboard/summary?range=today`).set(kiri.auth).expect(200);
      expect(res.body.range.from).toBe(todayInTimeZone('Pacific/Kiritimati'));
    });
  });

  describe('budgets', () => {
    let user: TestUser;
    const food = () => categoryId(user, 'Food & groceries');

    beforeAll(async () => {
      user = await registerUser(app);
      await add(user, {
        title: 'Salary',
        amount: '5000',
        type: 'INCOME',
        categoryId: categoryId(user, 'Salary'),
        date: '2025-06-01',
      });
      await add(user, {
        title: 'Food 1',
        amount: '300',
        type: 'EXPENSE',
        categoryId: food(),
        date: '2025-06-03',
      });
      await add(user, {
        title: 'Food 2',
        amount: '100',
        type: 'EXPENSE',
        categoryId: food(),
        date: '2025-06-30',
      });
      await add(user, {
        title: 'Rent',
        amount: '1000',
        type: 'EXPENSE',
        categoryId: categoryId(user, 'Housing & rent'),
        date: '2025-06-02',
      });
      await add(user, {
        title: 'July food',
        amount: '50',
        type: 'EXPENSE',
        categoryId: food(),
        date: '2025-07-01',
      });
    });

    it('calculates category usage from expenses in the period only', async () => {
      const created = await http
        .post(`${API}/budgets`)
        .set(user.auth)
        .send({ amount: '500', categoryId: food(), startDate: '2025-01-01' })
        .expect(201);
      expect(created.body.period).toBe('MONTHLY');

      const list = await http.get(`${API}/budgets?date=2025-06-15`).set(user.auth).expect(200);
      expect(list.body[0].status).toEqual({
        periodStart: '2025-06-01',
        periodEnd: '2025-06-30',
        spent: '400.00',
        remaining: '100.00',
        percentUsed: 80,
        state: 'warning',
      });
    });

    it('counts all expense categories (never income) for overall budgets and flags overspending', async () => {
      await http
        .post(`${API}/budgets`)
        .set(user.auth)
        .send({ amount: '1200.00', startDate: '2025-01-01', name: 'Everything' })
        .expect(201);
      const list = await http.get(`${API}/budgets?date=2025-06-15`).set(user.auth).expect(200);
      const overall = list.body.find((b: { category: unknown }) => b.category === null);
      expect(overall.status).toMatchObject({
        spent: '1400.00',
        remaining: '-200.00',
        state: 'exceeded',
        percentUsed: 116.7,
      });

      const summary = await http
        .get(`${API}/dashboard/summary?from=2025-06-01&to=2025-06-30`)
        .set(user.auth)
        .expect(200);
      expect(summary.body.monthlyBudget.status.state).toBe('exceeded');
      expect(summary.body.budgetAlerts.map((a: { state: string }) => a.state)).toEqual([
        'exceeded',
        'warning',
      ]);
      // Budgets never change the balance.
      expect(summary.body.netBalance).toBe('3600.00');
    });

    it('rejects overlapping budgets, income categories and invalid amounts', async () => {
      await http
        .post(`${API}/budgets`)
        .set(user.auth)
        .send({ amount: '100', categoryId: food(), startDate: '2025-05-01' })
        .expect(409);
      await http
        .post(`${API}/budgets`)
        .set(user.auth)
        .send({ amount: '100', categoryId: categoryId(user, 'Salary') })
        .expect(400);
      await http.post(`${API}/budgets`).set(user.auth).send({ amount: '-1' }).expect(400);
      await http
        .post(`${API}/budgets`)
        .set(user.auth)
        .send({ amount: '100', period: 'WEEKLY', startDate: '2025-06-10', endDate: '2025-06-01' })
        .expect(400);
    });

    it('returns no status outside the active window', async () => {
      const list = await http.get(`${API}/budgets?date=2024-12-31`).set(user.auth).expect(200);
      expect(list.body.every((b: { status: unknown }) => b.status === null)).toBe(true);
    });
  });

  describe('reports & export', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await registerUser(app);
      const food = categoryId(user, 'Food & groceries');
      await add(user, {
        title: 'Salary',
        amount: '2000',
        type: 'INCOME',
        categoryId: categoryId(user, 'Salary'),
        date: '2025-01-01',
      });
      await add(user, {
        title: '=cmd|calc',
        amount: '10.50',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-01-02',
        notes: 'note, with "quotes"',
      });
      await add(user, {
        title: 'Big shop',
        amount: '250',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-02-10',
      });
      await add(user, {
        title: 'Out of range',
        amount: '1',
        type: 'EXPENSE',
        categoryId: food,
        date: '2025-04-01',
      });
    });

    it('produces monthly report totals and largest transactions', async () => {
      const res = await http
        .get(`${API}/reports/transactions?from=2025-01-01&to=2025-03-31&granularity=month`)
        .set(user.auth)
        .expect(200);
      expect(res.body.totals).toEqual({
        income: '2000.00',
        expenses: '260.50',
        net: '1739.50',
        count: 3,
      });
      expect(
        res.body.periods.map((p: { label: string; expenses: string }) => [p.label, p.expenses]),
      ).toEqual([
        ['Jan 2025', '10.50'],
        ['Feb 2025', '250.00'],
        ['Mar 2025', '0.00'],
      ]);
      expect(res.body.largestExpenses[0].title).toBe('Big shop');
      expect(res.body.averageDailyExpense).toBe('2.89'); // 260.50 / 90 days
    });

    it('produces income vs expenses with savings rate and cumulative net', async () => {
      const res = await http
        .get(`${API}/reports/income-expenses?from=2025-01-01&to=2025-02-28&granularity=month`)
        .set(user.auth)
        .expect(200);
      expect(res.body.points[0]).toMatchObject({
        income: '2000.00',
        expenses: '10.50',
        savingsRate: 99.5,
        cumulativeNet: '1989.50',
      });
      expect(res.body.points[1]).toMatchObject({ savingsRate: null, cumulativeNet: '1739.50' });
    });

    it('exports CSV scoped to the range and user, escaping unsafe cells', async () => {
      const res = await http
        .get(`${API}/reports/export?from=2025-01-01&to=2025-03-31`)
        .set(user.auth)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toContain(
        'transactions_2025-01-01_to_2025-03-31.csv',
      );
      const lines = res.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n');
      expect(lines[0]).toBe(
        'Date,Type,Title,Category,Amount,Signed amount,Payment method,Tags,Notes',
      );
      expect(lines).toHaveLength(4);
      expect(lines[2]).toBe(
        `2025-01-02,Expense,'=cmd|calc,Food & groceries,10.50,-10.50,Cash,,"note, with ""quotes"""`,
      );
      expect(res.text).not.toContain('Out of range');

      await http.get(`${API}/reports/export?from=2025-01-01&to=2025-03-31`).expect(401);
    });
  });

  describe('recurring transactions', () => {
    let user: TestUser;
    let service: RecurringService;

    beforeAll(async () => {
      user = await registerUser(app);
      service = app.get(RecurringService);
    });

    it('generates past-due occurrences on creation and never duplicates them', async () => {
      const today = todayInTimeZone('UTC');
      const start = new Date(
        Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - 4),
      )
        .toISOString()
        .slice(0, 10);
      const res = await http
        .post(`${API}/recurring-transactions`)
        .set(user.auth)
        .send({
          title: 'Daily coffee',
          amount: '3.50',
          type: 'EXPENSE',
          categoryId: categoryId(user, 'Food & groceries'),
          frequency: 'DAILY',
          startDate: start,
        })
        .expect(201);
      expect(res.body).toMatchObject({ executionCount: 5, lastRunDate: today, isActive: true });

      const count = () =>
        prisma.transaction.count({ where: { recurringTransactionId: res.body.id } });
      expect(await count()).toBe(5);

      // Re-running (including concurrently) must not create duplicates.
      await Promise.all([
        service.processSchedule(res.body.id, today),
        service.processSchedule(res.body.id, today),
        service.processAllDue(),
      ]);
      await http.post(`${API}/recurring-transactions/process`).set(user.auth).expect(200);
      expect(await count()).toBe(5);

      // Even if the pointer is rewound, the unique execution record blocks duplicates.
      await prisma.recurringTransaction.update({
        where: { id: res.body.id },
        data: { nextRunDate: new Date(`${start}T00:00:00Z`) },
      });
      await service.processSchedule(res.body.id, today);
      expect(await count()).toBe(5);

      const history = await http
        .get(`${API}/recurring-transactions/${res.body.id}/executions`)
        .set(user.auth)
        .expect(200);
      expect(history.body).toHaveLength(5);
    });

    it('pauses and resumes, skipping occurrences missed while paused', async () => {
      const res = await http
        .post(`${API}/recurring-transactions`)
        .set(user.auth)
        .send({
          title: 'Gym',
          amount: '30',
          type: 'EXPENSE',
          categoryId: categoryId(user, 'Personal care'),
          frequency: 'MONTHLY',
          startDate: '2099-01-15',
        })
        .expect(201);
      expect(res.body).toMatchObject({ executionCount: 0, nextRunDate: '2099-01-15' });

      const paused = await http
        .post(`${API}/recurring-transactions/${res.body.id}/pause`)
        .set(user.auth)
        .expect(200);
      expect(paused.body.isActive).toBe(false);
      const resumed = await http
        .post(`${API}/recurring-transactions/${res.body.id}/resume`)
        .set(user.auth)
        .expect(200);
      expect(resumed.body).toMatchObject({ isActive: true, nextRunDate: '2099-01-15' });
    });

    it('validates input and enforces ownership', async () => {
      const other = await registerUser(app);
      const res = await http
        .post(`${API}/recurring-transactions`)
        .set(user.auth)
        .send({
          title: 'Rent',
          amount: '900',
          type: 'EXPENSE',
          categoryId: categoryId(user, 'Housing & rent'),
          frequency: 'MONTHLY',
          startDate: '2099-01-01',
          endDate: '2098-01-01',
        })
        .expect(400);
      expect(res.body.message).toMatch(/end date/i);

      await http
        .post(`${API}/recurring-transactions`)
        .set(user.auth)
        .send({
          title: 'X',
          amount: '1',
          type: 'EXPENSE',
          categoryId: categoryId(user, 'Other'),
          frequency: 'HOURLY',
          startDate: '2099-01-01',
        })
        .expect(400);

      const list = await http.get(`${API}/recurring-transactions`).set(user.auth).expect(200);
      await http
        .get(`${API}/recurring-transactions/${list.body[0].id}`)
        .set(other.auth)
        .expect(404);
      await http
        .delete(`${API}/recurring-transactions/${list.body[0].id}`)
        .set(other.auth)
        .expect(404);
    });

    it('keeps generated transactions when a schedule is deleted', async () => {
      const list = await http.get(`${API}/recurring-transactions`).set(user.auth).expect(200);
      const coffee = list.body.find((r: { title: string }) => r.title === 'Daily coffee');
      await http.delete(`${API}/recurring-transactions/${coffee.id}`).set(user.auth).expect(204);
      expect(
        await prisma.transaction.count({ where: { userId: user.user.id, title: 'Daily coffee' } }),
      ).toBe(5);
    });
  });
});
