import { loanBalance } from './loan-math';

describe('loanBalance', () => {
  const today = '2026-10-19';

  it('reports an untouched loan as fully outstanding', () => {
    const b = loanBalance('5000.00', [], null, today);
    expect(b.repaid.toFixed(2)).toBe('0.00');
    expect(b.outstanding.toFixed(2)).toBe('5000.00');
    expect(b.percentRepaid).toBe(0);
    expect(b.status).toBe('active');
  });

  it('sums repayments with decimal precision', () => {
    const b = loanBalance('100.00', ['33.33', '33.33', '0.01'], null, today);
    expect(b.repaid.toFixed(2)).toBe('66.67');
    expect(b.outstanding.toFixed(2)).toBe('33.33');
    expect(b.percentRepaid).toBe(66.7);
  });

  it('marks a loan paid once repayments cover the amount', () => {
    const b = loanBalance('100.00', ['60.00', '40.00'], '2026-01-01', today);
    expect(b.status).toBe('paid');
    expect(b.outstanding.toFixed(2)).toBe('0.00');
    expect(b.percentRepaid).toBe(100);
  });

  it('is overdue only after the due date passes with money still owed', () => {
    expect(loanBalance('100', ['10'], '2026-10-18', today).status).toBe('overdue');
    expect(loanBalance('100', ['10'], '2026-10-19', today).status).toBe('active');
  });
});
