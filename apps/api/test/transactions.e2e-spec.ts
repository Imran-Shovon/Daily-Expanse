import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, categoryId, createTestApp, registerUser, resetDatabase, TestUser } from './utils';

describe('Transactions & categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let alice: TestUser;
  let bob: TestUser;

  const create = (user: TestUser, body: Record<string, unknown>) =>
    http.post(`${API}/transactions`).set(user.auth).send(body);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
    alice = await registerUser(app);
    bob = await registerUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD', () => {
    let id: string;

    it('creates a transaction with normalised data', async () => {
      const res = await create(alice, {
        title: '  Groceries  ',
        amount: '84.20',
        type: 'EXPENSE',
        categoryId: categoryId(alice, 'Food & groceries'),
        date: '2026-10-05',
        paymentMethod: 'DEBIT_CARD',
        tags: ['Family', 'family', ' weekly '],
      }).expect(201);
      id = res.body.id;
      expect(res.body).toMatchObject({
        title: 'Groceries',
        amount: '84.20',
        date: '2026-10-05',
        tags: ['family', 'weekly'],
        category: { name: 'Food & groceries' },
      });
    });

    it('reads, updates and deletes it', async () => {
      await http.get(`${API}/transactions/${id}`).set(alice.auth).expect(200);
      const updated = await http
        .patch(`${API}/transactions/${id}`)
        .set(alice.auth)
        .send({ amount: 90, notes: 'Added fruit' })
        .expect(200);
      expect(updated.body).toMatchObject({
        amount: '90.00',
        notes: 'Added fruit',
        title: 'Groceries',
      });

      await http.delete(`${API}/transactions/${id}`).set(alice.auth).expect(204);
      await http.get(`${API}/transactions/${id}`).set(alice.auth).expect(404);
      await http.delete(`${API}/transactions/${id}`).set(alice.auth).expect(404);
    });

    it('rejects invalid amounts, dates and category/type mismatches', async () => {
      const base = {
        title: 'Test',
        amount: '10.00',
        type: 'EXPENSE',
        categoryId: categoryId(alice, 'Shopping'),
        date: '2026-10-05',
      };
      await create(alice, { ...base, amount: '10.555' }).expect(400);
      await create(alice, { ...base, amount: '-5' }).expect(400);
      await create(alice, { ...base, amount: '0' }).expect(400);
      await create(alice, { ...base, amount: 'abc' }).expect(400);
      await create(alice, { ...base, date: '2026-02-30' }).expect(400);
      await create(alice, { ...base, type: 'TRANSFER' }).expect(400);
      await create(alice, { ...base, title: '' }).expect(400);
      await create(alice, { ...base, userId: bob.user.id }).expect(400);
      const mismatch = await create(alice, {
        ...base,
        categoryId: categoryId(alice, 'Salary'),
      }).expect(400);
      expect(mismatch.body.message).toMatch(/income/i);
    });

    it('stores amounts exactly (no floating point drift)', async () => {
      const cat = categoryId(alice, 'Other');
      await create(alice, {
        title: 'a',
        amount: '0.10',
        type: 'EXPENSE',
        categoryId: cat,
        date: '2020-01-01',
      }).expect(201);
      await create(alice, {
        title: 'b',
        amount: '0.20',
        type: 'EXPENSE',
        categoryId: cat,
        date: '2020-01-01',
      }).expect(201);
      const report = await http
        .get(`${API}/dashboard/summary?from=2020-01-01&to=2020-01-01`)
        .set(alice.auth)
        .expect(200);
      expect(report.body.totalExpenses).toBe('0.30');
    });
  });

  describe('data isolation', () => {
    let aliceTx: string;

    beforeAll(async () => {
      const res = await create(alice, {
        title: 'Private',
        amount: '50',
        type: 'EXPENSE',
        categoryId: categoryId(alice, 'Healthcare'),
        date: '2026-10-01',
      }).expect(201);
      aliceTx = res.body.id;
    });

    it('hides other users records as not found', async () => {
      await http.get(`${API}/transactions/${aliceTx}`).set(bob.auth).expect(404);
      await http
        .patch(`${API}/transactions/${aliceTx}`)
        .set(bob.auth)
        .send({ amount: '1' })
        .expect(404);
      await http.delete(`${API}/transactions/${aliceTx}`).set(bob.auth).expect(404);
      const stillThere = await prisma.transaction.findUnique({ where: { id: aliceTx } });
      expect(stillThere?.amount.toFixed(2)).toBe('50.00');
    });

    it('never lists another user transactions', async () => {
      const res = await http.get(`${API}/transactions?pageSize=100`).set(bob.auth).expect(200);
      expect(res.body.data.find((t: { id: string }) => t.id === aliceTx)).toBeUndefined();
    });

    it('rejects using another user category', async () => {
      await create(bob, {
        title: 'Sneaky',
        amount: '5',
        type: 'EXPENSE',
        categoryId: categoryId(alice, 'Healthcare'),
        date: '2026-10-01',
      }).expect(400);
      await http
        .patch(`${API}/categories/${categoryId(alice, 'Healthcare')}`)
        .set(bob.auth)
        .send({ name: 'Mine now' })
        .expect(404);
      await http
        .delete(`${API}/categories/${categoryId(alice, 'Healthcare')}`)
        .set(bob.auth)
        .expect(404);
    });
  });

  describe('listing', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await registerUser(app);
      const food = categoryId(user, 'Food & groceries');
      const salary = categoryId(user, 'Salary');
      const rows = [
        {
          title: 'Coffee beans',
          amount: '12.00',
          type: 'EXPENSE',
          categoryId: food,
          date: '2026-09-30',
          paymentMethod: 'CASH',
          tags: ['coffee'],
        },
        {
          title: 'Supermarket',
          amount: '64.10',
          type: 'EXPENSE',
          categoryId: food,
          date: '2026-10-01',
          paymentMethod: 'DEBIT_CARD',
          notes: 'Weekly coffee and bread',
        },
        {
          title: 'Salary',
          amount: '3000.00',
          type: 'INCOME',
          categoryId: salary,
          date: '2026-10-01',
          paymentMethod: 'BANK_TRANSFER',
        },
        {
          title: 'Dinner',
          amount: '45.50',
          type: 'EXPENSE',
          categoryId: food,
          date: '2026-10-31',
          paymentMethod: 'CREDIT_CARD',
        },
        {
          title: 'Bakery',
          amount: '6.25',
          type: 'EXPENSE',
          categoryId: food,
          date: '2026-11-01',
          paymentMethod: 'CASH',
        },
      ];
      for (const row of rows) await create(user, row).expect(201);
    });

    it('paginates with metadata', async () => {
      const page1 = await http
        .get(`${API}/transactions?pageSize=2&page=1`)
        .set(user.auth)
        .expect(200);
      expect(page1.body.meta).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
      const page3 = await http
        .get(`${API}/transactions?pageSize=2&page=3`)
        .set(user.auth)
        .expect(200);
      expect(page3.body.data).toHaveLength(1);
      await http.get(`${API}/transactions?pageSize=500`).set(user.auth).expect(400);
    });

    it('filters by inclusive date range boundaries', async () => {
      const res = await http
        .get(`${API}/transactions?from=2026-10-01&to=2026-10-31`)
        .set(user.auth)
        .expect(200);
      expect(res.body.data.map((t: { title: string }) => t.title).sort()).toEqual([
        'Dinner',
        'Salary',
        'Supermarket',
      ]);
      await http
        .get(`${API}/transactions?from=2026-10-31&to=2026-10-01`)
        .set(user.auth)
        .expect(400);
    });

    it('filters by type, payment method, category and tag', async () => {
      const income = await http.get(`${API}/transactions?type=INCOME`).set(user.auth).expect(200);
      expect(income.body.meta.total).toBe(1);
      const cash = await http
        .get(`${API}/transactions?paymentMethod=CASH`)
        .set(user.auth)
        .expect(200);
      expect(cash.body.meta.total).toBe(2);
      const tagged = await http.get(`${API}/transactions?tag=coffee`).set(user.auth).expect(200);
      expect(tagged.body.data[0].title).toBe('Coffee beans');
      const byCat = await http
        .get(`${API}/transactions?categoryId=${categoryId(user, 'Salary')}`)
        .set(user.auth)
        .expect(200);
      expect(byCat.body.meta.total).toBe(1);
    });

    it('searches title and notes case-insensitively', async () => {
      const res = await http.get(`${API}/transactions?search=COFFEE`).set(user.auth).expect(200);
      expect(res.body.data.map((t: { title: string }) => t.title).sort()).toEqual([
        'Coffee beans',
        'Supermarket',
      ]);
    });

    it('sorts by amount', async () => {
      const res = await http
        .get(`${API}/transactions?sortBy=amount&sortOrder=asc`)
        .set(user.auth)
        .expect(200);
      expect(res.body.data.map((t: { amount: string }) => t.amount)).toEqual([
        '6.25',
        '12.00',
        '45.50',
        '64.10',
        '3000.00',
      ]);
      await http.get(`${API}/transactions?sortBy=password`).set(user.auth).expect(400);
    });
  });

  describe('categories', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await registerUser(app);
    });

    it('creates custom categories and rejects duplicates and bad values', async () => {
      const res = await http
        .post(`${API}/categories`)
        .set(user.auth)
        .send({ name: 'Coffee', type: 'EXPENSE', color: '#7c3aed', icon: 'coffee' })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Coffee', isDefault: false, transactionCount: 0 });

      await http
        .post(`${API}/categories`)
        .set(user.auth)
        .send({ name: 'Coffee', type: 'EXPENSE', color: '#7c3aed', icon: 'coffee' })
        .expect(409);
      // Same name is fine for the other type
      await http
        .post(`${API}/categories`)
        .set(user.auth)
        .send({ name: 'Coffee', type: 'INCOME', color: '#7c3aed', icon: 'coffee' })
        .expect(201);
      await http
        .post(`${API}/categories`)
        .set(user.auth)
        .send({ name: 'Bad', type: 'EXPENSE', color: 'red', icon: 'coffee' })
        .expect(400);
      await http
        .post(`${API}/categories`)
        .set(user.auth)
        .send({ name: 'Bad', type: 'EXPENSE', color: '#ffffff', icon: 'rocket-launcher' })
        .expect(400);
    });

    it('blocks deleting a category in use unless transactions are reassigned', async () => {
      const travel = categoryId(user, 'Travel');
      const other = categoryId(user, 'Other');
      const tx = await create(user, {
        title: 'Flight',
        amount: '300',
        type: 'EXPENSE',
        categoryId: travel,
        date: '2026-10-01',
      }).expect(201);

      const blocked = await http.delete(`${API}/categories/${travel}`).set(user.auth).expect(409);
      expect(blocked.body.details).toMatchObject({ transactions: 1 });

      await http
        .delete(`${API}/categories/${travel}?reassignTo=${categoryId(user, 'Salary')}`)
        .set(user.auth)
        .expect(400);
      await http
        .delete(`${API}/categories/${travel}?reassignTo=${other}`)
        .set(user.auth)
        .expect(204);

      const moved = await http.get(`${API}/transactions/${tx.body.id}`).set(user.auth).expect(200);
      expect(moved.body.category.name).toBe('Other');
    });

    it('deletes an unused category directly', async () => {
      await http
        .delete(`${API}/categories/${categoryId(user, 'Gifts')}`)
        .set(user.auth)
        .expect(204);
    });

    it('prevents changing the type of a category in use', async () => {
      await http
        .patch(`${API}/categories/${categoryId(user, 'Other')}`)
        .set(user.auth)
        .send({ type: 'INCOME' })
        .expect(409);
    });
  });
});
