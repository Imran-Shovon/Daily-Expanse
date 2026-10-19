import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localizeDigits, localizePeriodLabel, translate } from './i18n/translate.ts';
import { formatDate, formatMoney, formatPercent } from './format.ts';

test('language switching translates UI and falls back safely for unknown text', () => {
  assert.equal(translate('bn', 'Add transaction'), 'লেনদেন যোগ করুন');
  assert.equal(translate('en', 'Add transaction'), 'Add transaction');
  assert.equal(translate('bn', 'Custom user text'), 'Custom user text');
});

test('Bangla interpolations localize counts while preserving user data', () => {
  assert.equal(translate('bn', '{count} transactions', { count: 25 }), '২৫টি লেনদেন');
  assert.equal(translate('en', '{count} transactions', { count: 25 }), '25 transactions');
  assert.equal(
    translate('bn', 'Category "{name}" saved', { name: 'Project 2026 {count}' }),
    'বিভাগ "Project 2026 {count}" সংরক্ষণ হয়েছে',
  );
  assert.equal(
    translate('bn', 'Downloaded {v0}', { v0: 'report-2026.csv' }),
    'report-2026.csv ডাউনলোড হয়েছে',
  );
});

test('Bangla formats money, dates and percentages without changing calendar dates', () => {
  assert.equal(formatDate('2026-03-05', 'yyyy-MM-dd', 'bn-BD'), '২০২৬-০৩-০৫');
  assert.match(formatDate('2026-03-05', 'MMM d, yyyy', 'bn-BD'), /মার্চ ৫, ২০২৬/);
  assert.equal(formatDate('2026-03-05', 'yyyy-MM-dd', 'en-US'), '2026-03-05');
  assert.match(formatMoney('1234.5', 'BDT', {}, 'bn-BD'), /১,২৩৪\.৫০/);
  assert.equal(formatMoney('1234.5', 'BDT', {}, 'en-US'), '৳1,234.50');
  assert.equal(formatPercent(80.5, 1, 'bn-BD'), '৮০.৫%');
  assert.equal(formatPercent(null, 1, 'bn-BD'), '—');
  assert.equal(localizeDigits('Page 12 / 30', 'bn'), 'Page ১২ / ৩০');
});

test('analytics labels retain the API bucket boundaries in Bangla', () => {
  assert.equal(localizePeriodLabel('Wk Mar 5', 'bn'), 'সপ্তাহ মার্চ ৫');
  assert.equal(localizePeriodLabel('Nov 2026', 'bn'), 'নভে ২০২৬');
  assert.equal(localizePeriodLabel('2026', 'bn'), '২০২৬');
  assert.equal(localizePeriodLabel('Wk Mar 5', 'en'), 'Wk Mar 5');
});
