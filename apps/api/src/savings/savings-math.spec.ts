import { chronological, savingsBalance, type EntryLike } from './savings-math';

let tick = 0;
const entry = (type: EntryLike['type'], amount: string, date: string): EntryLike => ({
  type,
  amount,
  date,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
});
const add = (amount: string, date = '2026-01-01') => entry('DEPOSIT', amount, date);
const takeOut = (amount: string, date = '2026-01-01') => entry('WITHDRAWAL', amount, date);

describe('savingsBalance', () => {
  it('adds deposits and subtracts withdrawals with decimal precision', () => {
    expect(savingsBalance([add('0.10'), add('0.20'), takeOut('0.05')]).toFixed(2)).toBe('0.25');
    expect(savingsBalance([]).toFixed(2)).toBe('0.00');
  });
});

describe('chronological', () => {
  it('orders by date, then by recording time within a day', () => {
    const later = add('1', '2026-02-01');
    const first = add('2', '2026-01-15');
    const second = takeOut('1', '2026-01-15');
    expect(chronological([later, second, first])).toEqual([first, second, later]);
  });
});
