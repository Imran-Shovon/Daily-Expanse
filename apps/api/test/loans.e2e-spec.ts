import type { Loan, LoansOverview } from '@expense/shared';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, createTestApp, registerUser, resetDatabase, TestUser } from './utils';

describe('Loans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let user: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
    user = await registerUser(app);
    other = await registerUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const borrow = (body: Record<string, unknown>) =>
    http.post(`${API}/loans`).set(user.auth).send(body);
  const repay = (id: string, body: Record<string, unknown>, as: TestUser = user) =>
    http.post(`${API}/loans/${id}/repayments`).set(as.auth).send(body);

  it('tracks repayments down to a paid-off loan', async () => {
    const created = (
      await borrow({ lender: 'Rahim', amount: '1000.00', borrowedOn: '2026-01-10' }).expect(201)
    ).body as Loan;
    expect(created).toMatchObject({ outstanding: '1000.00', repaid: '0.00', status: 'active' });

    const partial = (
      await repay(created.id, { amount: '400.50', paidOn: '2026-02-01' }).expect(201)
    ).body as Loan;
    expect(partial).toMatchObject({ repaid: '400.50', outstanding: '599.50', percentRepaid: 40.1 });

    await repay(created.id, { amount: '600.00', paidOn: '2026-03-01' })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/599\.50/));

    const paid = (await repay(created.id, { amount: '599.50', paidOn: '2026-03-01' }).expect(201))
      .body as Loan;
    expect(paid).toMatchObject({ status: 'paid', outstanding: '0.00', percentRepaid: 100 });
    expect(paid.repayments.map((r) => r.paidOn)).toEqual(['2026-03-01', '2026-02-01']);

    await repay(created.id, { amount: '1.00' }).expect(400);

    const undone = (
      await http
        .delete(`${API}/loans/${created.id}/repayments/${paid.repayments[0]!.id}`)
        .set(user.auth)
        .expect(200)
    ).body as Loan;
    expect(undone).toMatchObject({ status: 'active', outstanding: '599.50' });
  });

  it('flags overdue loans and summarises totals', async () => {
    await borrow({
      lender: 'Bank',
      amount: '500',
      borrowedOn: '2025-01-01',
      dueDate: '2025-06-30',
    }).expect(201);
    const overview = (await http.get(`${API}/loans`).set(user.auth).expect(200))
      .body as LoansOverview;
    expect(overview.loans[0]).toMatchObject({ lender: 'Bank', status: 'overdue' });
    expect(overview.totals).toEqual({
      borrowed: '1500.00',
      repaid: '400.50',
      outstanding: '1099.50',
      activeCount: 2,
      overdueCount: 1,
    });
  });

  it('validates dates and amounts', async () => {
    await borrow({
      lender: 'X',
      amount: '10',
      borrowedOn: '2026-05-01',
      dueDate: '2026-04-01',
    }).expect(400);
    await borrow({ lender: '', amount: '10' }).expect(400);
    await borrow({ lender: 'X', amount: '-5' }).expect(400);

    const loan = (
      await borrow({ lender: 'Y', amount: '100', borrowedOn: '2026-05-01' }).expect(201)
    ).body as Loan;
    await repay(loan.id, { amount: '10', paidOn: '2026-04-30' }).expect(400);
    await repay(loan.id, { amount: '60', paidOn: '2026-05-02' }).expect(201);
    await http.patch(`${API}/loans/${loan.id}`).set(user.auth).send({ amount: '50' }).expect(400);
    await http
      .patch(`${API}/loans/${loan.id}`)
      .set(user.auth)
      .send({ borrowedOn: '2026-05-03' })
      .expect(400);
    const updated = (
      await http.patch(`${API}/loans/${loan.id}`).set(user.auth).send({ amount: '60' }).expect(200)
    ).body as Loan;
    expect(updated.status).toBe('paid');
  });

  it("never exposes or changes another user's loans", async () => {
    const loan = (await borrow({ lender: 'Private', amount: '100' }).expect(201)).body as Loan;
    const theirs = (await http.get(`${API}/loans`).set(other.auth).expect(200))
      .body as LoansOverview;
    expect(theirs.loans).toEqual([]);
    await repay(loan.id, { amount: '10' }, other).expect(404);
    await http.patch(`${API}/loans/${loan.id}`).set(other.auth).send({ lender: 'Z' }).expect(404);
    await http.delete(`${API}/loans/${loan.id}`).set(other.auth).expect(404);
    await http.delete(`${API}/loans/${loan.id}`).set(user.auth).expect(204);
  });

  it('serialises concurrent repayments so a loan is never overpaid', async () => {
    const loan = (await borrow({ lender: 'Race', amount: '100' }).expect(201)).body as Loan;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repay(loan.id, { amount: '40' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    const sum = await prisma.loanRepayment.aggregate({
      where: { loanId: loan.id },
      _sum: { amount: true },
    });
    expect(sum._sum.amount?.toFixed(2)).toBe('80.00');
  });
});
