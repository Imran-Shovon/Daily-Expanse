import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatDate,
  formatMoney,
  formatPercent,
  initials,
  isValidAmount,
  todayIn,
} from './format.ts';

test('formatDate supports every preference pattern', () => {
  assert.equal(formatDate('2026-03-05', 'yyyy-MM-dd'), '2026-03-05');
  assert.equal(formatDate('2026-03-05', 'dd/MM/yyyy'), '05/03/2026');
  assert.equal(formatDate('2026-03-05', 'MM/dd/yyyy'), '03/05/2026');
  assert.equal(formatDate('2026-03-05', 'dd MMM yyyy'), '05 Mar 2026');
  assert.equal(formatDate('2026-03-05', 'MMM d, yyyy'), 'Mar 5, 2026');
  assert.equal(formatDate('not a date'), 'not a date');
});

test('formatMoney formats decimal strings with the currency', () => {
  assert.match(formatMoney('1234.5', 'USD'), /1,234\.50/);
  assert.match(formatMoney('-20', 'USD'), /20\.00/);
  assert.match(formatMoney('abc', 'USD'), /0\.00/);
  assert.match(formatMoney('10', 'XXX-invalid'), /10\.00/);
});

test('formatPercent handles null and trims zeros', () => {
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(25), '25%');
  assert.equal(formatPercent(33.33), '33.3%');
});

test('isValidAmount mirrors the API rule', () => {
  assert.equal(isValidAmount('10'), true);
  assert.equal(isValidAmount('10.5'), true);
  assert.equal(isValidAmount('0.01'), true);
  assert.equal(isValidAmount('0'), false);
  assert.equal(isValidAmount('10.555'), false);
  assert.equal(isValidAmount('-1'), false);
  assert.equal(isValidAmount('01'), false);
});

test('todayIn respects the time zone', () => {
  const instant = new Date('2026-10-13T22:30:00Z');
  assert.equal(todayIn('Asia/Dhaka', instant), '2026-10-14');
  assert.equal(todayIn('America/New_York', instant), '2026-10-13');
});

test('initials', () => {
  assert.equal(initials('Ada Lovelace'), 'AL');
  assert.equal(initials(''), '?');
});
