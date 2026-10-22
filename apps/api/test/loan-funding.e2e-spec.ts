import type { Loan, LoansOverview, Paginated, SavingsSummary, Transaction } from '@expense/shared';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDays, todayInTimeZone } from '../src/common/utils/plain-date';
import { PrismaService } from '../src/prisma/prisma.service';
import { API, createTestApp, registerUser, resetDatabase, TestUser } from './utils';

describe('Where a loan repayment came from (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  // Test users are registered without a time zone, so "today" is UTC.
  const today = todayInTimeZone('UTC');

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  const borrow = async (user: TestUser, amount = '10000') =>
    (
      await http
        .post(`${API}/loans`)
        .set(user.auth)
        .send({ counterparty: 'City Bank', amount, loanDate: addDays(today, -30) })
        .expect(201)
    ).body as Loan;
  const repay = (user: TestUser, loanId: string, body: Record<string, unknown>) =>
    http
      .post(`${API}/loans/${loanId}/repayments`)
      .set(user.auth)
      .send({ paidOn: today, ...body });
  const save = (user: TestUser, amount: string) =>
    http
      .post(`${API}/savings/entries`)
      .set(user.auth)
      .send({ type: 'DEPOSIT', amount, source: 'Salary' })
      .expect(201);
  const savingsBalance = async (user: TestUser) =>
    ((await http.get(`${API}/savings`).set(user.auth).expect(200)).body as SavingsSummary).balance;
  const repaymentExpenses = async (user: TestUser) =>
    (
      (await http.get(`${API}/transactions`).query({ tag: 'loan-repayment' }).set(user.auth))
        .body as Paginated<Transaction>
    ).data;
  const loans = async (user: TestUser) =>
    ((await http.get(`${API}/loans`).set(user.auth).expect(200)).body as LoansOverview).loans;

  it('records salary as an expense for the month', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    const updated = (await repay(user, loan.id, { amount: '1500', source: 'SALARY' }).expect(201))
      .body as Loan;
    expect(updated.repayments[0]!.funding).toMatchObject({
      source: 'SALARY',
      fromSalary: '1500.00',
      fromSavings: null,
      loan: null,
    });

    const [expense] = await repaymentExpenses(user);
    expect(expense).toMatchObject({
      type: 'EXPENSE',
      amount: '1500.00',
      date: today,
      title: 'Loan repayment: City Bank',
      category: { name: 'Loan repayment' },
    });
    expect(expense!.id).toBe(updated.repayments[0]!.funding!.transactionId);
  });

  it('takes savings out of the savings balance, never more than is saved', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await save(user, '2000');

    await repay(user, loan.id, { amount: '2500', source: 'SAVINGS' })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/2000\.00/));
    await repay(user, loan.id, {
      amount: '500',
      source: 'SAVINGS',
      paidOn: addDays(today, 1),
    }).expect(400);
    expect(await savingsBalance(user)).toBe('2000.00');

    const updated = (await repay(user, loan.id, { amount: '1200', source: 'SAVINGS' }).expect(201))
      .body as Loan;
    expect(updated.repayments[0]!.funding).toMatchObject({
      source: 'SAVINGS',
      fromSavings: '1200.00',
    });
    expect(await savingsBalance(user)).toBe('800.00');
    const entry = await prisma.savingsEntry.findFirstOrThrow({
      where: { type: 'WITHDRAWAL', userId: user.user.id },
    });
    expect(entry).toMatchObject({
      purpose: 'Debt repayment',
      notes: 'Loan repayment to City Bank',
    });
    expect(await repaymentExpenses(user)).toHaveLength(0);
  });

  it('splits between salary and savings when the parts add up', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await save(user, '1000');

    await repay(user, loan.id, { amount: '3000', source: 'SALARY_AND_SAVINGS' }).expect(400);
    await repay(user, loan.id, {
      amount: '3000',
      source: 'SALARY_AND_SAVINGS',
      fromSalary: '2000',
      fromSavings: '900',
    })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/add up/));

    const updated = (
      await repay(user, loan.id, {
        amount: '3000',
        source: 'SALARY_AND_SAVINGS',
        fromSalary: '2000.50',
        fromSavings: '999.50',
      }).expect(201)
    ).body as Loan;
    expect(updated.repayments[0]!.funding).toMatchObject({
      fromSalary: '2000.50',
      fromSavings: '999.50',
    });
    expect(await savingsBalance(user)).toBe('0.50');
    expect((await repaymentExpenses(user))[0]!.amount).toBe('2000.50');
  });

  it('adds a new borrowed loan when the money was borrowed', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await repay(user, loan.id, { amount: '4000', source: 'LOAN' }).expect(400);

    const updated = (
      await repay(user, loan.id, { amount: '4000', source: 'LOAN', fundingLender: 'Karim' }).expect(
        201,
      )
    ).body as Loan;
    const funding = updated.repayments[0]!.funding!;
    expect(funding.loan?.counterparty).toBe('Karim');

    const karim = (await loans(user)).find((l) => l.id === funding.loan!.id);
    expect(karim).toMatchObject({
      direction: 'BORROWED',
      amount: '4000.00',
      loanDate: today,
      outstanding: '4000.00',
      notes: 'Taken to repay City Bank',
    });
  });

  it('keeps an explanation for other sources and records nothing else', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await repay(user, loan.id, { amount: '100', source: 'OTHER' }).expect(400);
    const updated = (
      await repay(user, loan.id, {
        amount: '100',
        source: 'OTHER',
        sourceNote: 'Sold my old phone',
      }).expect(201)
    ).body as Loan;
    expect(updated.repayments[0]!.funding).toMatchObject({
      source: 'OTHER',
      note: 'Sold my old phone',
    });
    expect(await repaymentExpenses(user)).toHaveLength(0);
    expect(await loans(user)).toHaveLength(1);
  });

  it('requires a source when repaying, and takes none when collecting', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await repay(user, loan.id, { amount: '100', source: undefined })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/came from/));
    await repay(user, loan.id, { amount: '100', source: 'GIFT' }).expect(400);

    const lent = (
      await http
        .post(`${API}/loans`)
        .set(user.auth)
        .send({
          direction: 'LENT',
          counterparty: 'Rafi',
          amount: '500',
          loanDate: addDays(today, -5),
        })
        .expect(201)
    ).body as Loan;
    await repay(user, lent.id, { amount: '100', source: 'SALARY' }).expect(400);
    const collected = (await repay(user, lent.id, { amount: '100' }).expect(201)).body as Loan;
    expect(collected.repayments[0]!.funding).toBeNull();
  });

  it('moves the recorded money when a repayment is edited', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await save(user, '5000');
    const created = (await repay(user, loan.id, { amount: '1000', source: 'SALARY' }).expect(201))
      .body as Loan;
    const repaymentId = created.repayments[0]!.id;
    const edit = (body: Record<string, unknown>) =>
      http.patch(`${API}/loans/${loan.id}/repayments/${repaymentId}`).set(user.auth).send(body);

    // Same source, new amount: the expense follows.
    await edit({ amount: '1200' }).expect(200);
    expect((await repaymentExpenses(user))[0]!.amount).toBe('1200.00');

    // Switching to savings removes the expense and withdraws from savings instead.
    const toSavings = (await edit({ source: 'SAVINGS' }).expect(200)).body as Loan;
    expect(toSavings.repayments[0]!.funding).toMatchObject({
      source: 'SAVINGS',
      fromSavings: '1200.00',
    });
    expect(await repaymentExpenses(user)).toHaveLength(0);
    expect(await savingsBalance(user)).toBe('3800.00');

    // A split must be restated when the amount changes.
    await edit({ source: 'SALARY_AND_SAVINGS', fromSalary: '700', fromSavings: '500' }).expect(200);
    expect(await savingsBalance(user)).toBe('4500.00');
    await edit({ amount: '1300' })
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/salary and how much from savings/));
  });

  it('undoes what a repayment recorded when it is removed', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await save(user, '1000');
    const created = (
      await repay(user, loan.id, {
        amount: '1500',
        source: 'SALARY_AND_SAVINGS',
        fromSalary: '1000',
        fromSavings: '500',
      }).expect(201)
    ).body as Loan;
    await http
      .delete(`${API}/loans/${loan.id}/repayments/${created.repayments[0]!.id}`)
      .set(user.auth)
      .expect(200);
    expect(await repaymentExpenses(user)).toHaveLength(0);
    expect(await savingsBalance(user)).toBe('1000.00');
  });

  it('removes the loan taken for a repayment, unless that loan is being repaid', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    const created = (
      await repay(user, loan.id, { amount: '2000', source: 'LOAN', fundingLender: 'Karim' }).expect(
        201,
      )
    ).body as Loan;
    const repaymentId = created.repayments[0]!.id;
    const karimId = created.repayments[0]!.funding!.loan!.id;

    // Karim's loan has a repayment of its own now, so it must not silently disappear.
    await repay(user, karimId, { amount: '100', source: 'OTHER', sourceNote: 'Cash' }).expect(201);
    await http
      .delete(`${API}/loans/${loan.id}/repayments/${repaymentId}`)
      .set(user.auth)
      .expect(400)
      .expect((res) => expect(res.body.message).toMatch(/Karim/));
    expect(await loans(user)).toHaveLength(2);

    // Once that is undone, removing the repayment removes Karim's loan too.
    const karim = (await loans(user)).find((l) => l.id === karimId)!;
    await http
      .delete(`${API}/loans/${karimId}/repayments/${karim.repayments[0]!.id}`)
      .set(user.auth)
      .expect(200);
    await http
      .delete(`${API}/loans/${loan.id}/repayments/${repaymentId}`)
      .set(user.auth)
      .expect(200);
    expect((await loans(user)).map((l) => l.id)).toEqual([loan.id]);
  });

  it('undoes recorded expenses and withdrawals when the whole loan is deleted', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    await save(user, '800');
    await repay(user, loan.id, { amount: '300', source: 'SALARY' }).expect(201);
    await repay(user, loan.id, { amount: '400', source: 'SAVINGS' }).expect(201);
    expect(await savingsBalance(user)).toBe('400.00');

    await http.delete(`${API}/loans/${loan.id}`).set(user.auth).expect(204);
    expect(await repaymentExpenses(user)).toHaveLength(0);
    expect(await savingsBalance(user)).toBe('800.00');
  });

  it('keeps the repayment when its expense is deleted from transactions', async () => {
    const user = await registerUser(app);
    const loan = await borrow(user);
    const created = (await repay(user, loan.id, { amount: '250', source: 'SALARY' }).expect(201))
      .body as Loan;
    await http
      .delete(`${API}/transactions/${created.repayments[0]!.funding!.transactionId}`)
      .set(user.auth)
      .expect(204);
    const [after] = await loans(user);
    expect(after!.repaid).toBe('250.00');
    expect(after!.repayments[0]!.funding).toMatchObject({ source: 'SALARY', fromSalary: null });
  });
});
