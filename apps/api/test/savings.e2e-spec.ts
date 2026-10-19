import type { Paginated, SavingsEntry, SavingsSummary } from '@expense/shared';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, startOfMonth, todayInTimeZone } from '../src/common/utils/plain-date';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, createTestApp, registerUser, resetDatabase, TestUser } from './utils';

describe('Savings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  // Test users are registered without a time zone, so "today" is UTC.
  const today = todayInTimeZone('UTC');
  const lastMonth = addDays(startOfMonth(today), -1);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  /** Fills in a source or purpose so tests only spell it out when it matters. */
  const add = (user: TestUser, body: Record<string, unknown>) =>
    http
      .post(`${API}/savings/entries`)
      .set(user.auth)
      .send(
        body.type === 'DEPOSIT' ? { source: 'Salary', ...body } : { purpose: 'Other', ...body },
      );
  const raw = (user: TestUser, body: Record<string, unknown>) =>
    http.post(`${API}/savings/entries`).set(user.auth).send(body);
  const summary = async (user: TestUser) =>
    (await http.get(`${API}/savings`).set(user.auth).expect(200)).body as SavingsSummary;
  const history = async (user: TestUser, query: Record<string, unknown> = {}) =>
    (await http.get(`${API}/savings/entries`).query(query).set(user.auth).expect(200))
      .body as Paginated<SavingsEntry>;

  it('adds and takes out money with a full history', async () => {
    const user = await registerUser(app);
    expect(await summary(user)).toMatchObject({ balance: '0.00', entryCount: 0 });

    await add(user, { type: 'DEPOSIT', amount: '1000.00', date: lastMonth, notes: 'Bonus' }).expect(
      201,
    );
    const deposit = (await add(user, { type: 'DEPOSIT', amount: '250.50' }).expect(201))
      .body as SavingsEntry;
    expect(deposit).toMatchObject({ type: 'DEPOSIT', amount: '250.50', balanceAfter: '1250.50' });
    await add(user, {
      type: 'WITHDRAWAL',
      amount: '300.00',
      purpose: 'Medical expenses',
      notes: 'Phone repair',
    }).expect(201);

    expect(await summary(user)).toEqual({
      balance: '950.50',
      totalAdded: '1250.50',
      totalTakenOut: '300.00',
      thisMonth: { added: '250.50', takenOut: '300.00' },
      entryCount: 3,
    });

    const { data, meta } = await history(user);
    expect(meta).toMatchObject({ total: 3, page: 1 });
    expect(data.map((e) => [e.type, e.amount, e.balanceAfter])).toEqual([
      ['WITHDRAWAL', '300.00', '950.50'],
      ['DEPOSIT', '250.50', '1250.50'],
      ['DEPOSIT', '1000.00', '1000.00'],
    ]);
    expect(data[2]).toMatchObject({ date: lastMonth, notes: 'Bonus' });
    expect(data[0]).toMatchObject({ purpose: 'Medical expenses', source: null });
    expect(data[1]).toMatchObject({ source: 'Salary', purpose: null });
  });

  it('requires a source for deposits and a purpose for withdrawals', async () => {
    const user = await registerUser(app);
    await raw(user, { type: 'DEPOSIT', amount: '10' }).expect(400);
    await raw(user, { type: 'DEPOSIT', amount: '10', source: '   ' }).expect(400);
    await raw(user, { type: 'DEPOSIT', amount: '10', source: 'x'.repeat(81) }).expect(400);
    const deposit = (
      await raw(user, {
        type: 'DEPOSIT',
        amount: '10',
        source: '  Freelance work ',
        purpose: 'ignored',
      }).expect(201)
    ).body as SavingsEntry;
    // Trimmed, and the field that does not match the direction is dropped.
    expect(deposit).toMatchObject({ source: 'Freelance work', purpose: null });

    await raw(user, { type: 'WITHDRAWAL', amount: '5' }).expect(400);
    const withdrawal = (
      await raw(user, { type: 'WITHDRAWAL', amount: '5', purpose: 'Education' }).expect(201)
    ).body as SavingsEntry;
    expect(withdrawal).toMatchObject({ purpose: 'Education', source: null });
  });

  it('filters and paginates the history while keeping the real running balance', async () => {
    const user = await registerUser(app);
    await add(user, { type: 'DEPOSIT', amount: '100', date: lastMonth }).expect(201);
    await add(user, { type: 'WITHDRAWAL', amount: '30' }).expect(201);
    await add(user, { type: 'DEPOSIT', amount: '50' }).expect(201);

    const withdrawals = await history(user, { type: 'WITHDRAWAL' });
    expect(withdrawals.meta.total).toBe(1);
    expect(withdrawals.data[0]).toMatchObject({ amount: '30.00', balanceAfter: '70.00' });

    const page2 = await history(user, { page: 2, pageSize: 2 });
    expect(page2.meta).toMatchObject({ total: 3, totalPages: 2 });
    expect(page2.data.map((e) => e.balanceAfter)).toEqual(['100.00']);
  });

  it('never lets savings go below zero', async () => {
    const user = await registerUser(app);
    await add(user, { type: 'WITHDRAWAL', amount: '1' }).expect(400);
    await add(user, { type: 'DEPOSIT', amount: '100' }).expect(201);
    await add(user, { type: 'WITHDRAWAL', amount: '100.01' })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/100\.00/));
    // Only the current balance matters, so a withdrawal may be dated before the deposit.
    await add(user, { type: 'WITHDRAWAL', amount: '50', date: lastMonth }).expect(201);
    await add(user, { type: 'WITHDRAWAL', amount: '50.01' }).expect(400);
    await add(user, { type: 'WITHDRAWAL', amount: '50' }).expect(201);
    expect((await summary(user)).balance).toBe('0.00');
  });

  it('removes entries but refuses removals that would leave the balance below zero', async () => {
    const user = await registerUser(app);
    const deposit = (await add(user, { type: 'DEPOSIT', amount: '100' }).expect(201))
      .body as SavingsEntry;
    const withdrawal = (await add(user, { type: 'WITHDRAWAL', amount: '60' }).expect(201))
      .body as SavingsEntry;
    const remove = (id: string) => http.delete(`${API}/savings/entries/${id}`).set(user.auth);

    await remove(deposit.id).expect(400);
    await remove(withdrawal.id).expect(204);
    await remove(deposit.id).expect(204);
    expect(await summary(user)).toMatchObject({ balance: '0.00', entryCount: 0 });
    await remove(deposit.id).expect(404);
  });

  it('validates input', async () => {
    const user = await registerUser(app);
    await add(user, { type: 'DEPOSIT', amount: '10', date: addDays(today, 1) }).expect(400);
    await add(user, { type: 'BORROW', amount: '10' }).expect(400);
    await add(user, { type: 'DEPOSIT', amount: '0' }).expect(400);
    await add(user, { type: 'DEPOSIT', amount: '1.234' }).expect(400);
    await add(user, { type: 'DEPOSIT', amount: '10', notes: 'x'.repeat(501) }).expect(400);
    await http.get(`${API}/savings/entries`).query({ pageSize: 500 }).set(user.auth).expect(400);
  });

  it("keeps each user's savings private", async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const entry = (await add(owner, { type: 'DEPOSIT', amount: '75' }).expect(201))
      .body as SavingsEntry;

    expect((await summary(other)).balance).toBe('0.00');
    expect((await history(other)).data).toEqual([]);
    await http.delete(`${API}/savings/entries/${entry.id}`).set(other.auth).expect(404);
    expect((await summary(owner)).balance).toBe('75.00');
  });

  it('serialises concurrent withdrawals so the balance never goes negative', async () => {
    const user = await registerUser(app);
    await add(user, { type: 'DEPOSIT', amount: '100' }).expect(201);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => add(user, { type: 'WITHDRAWAL', amount: '40' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect((await summary(user)).balance).toBe('20.00');
  });
});
