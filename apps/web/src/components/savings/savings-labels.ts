import type { SavingsEntryType } from '@expense/shared';

/**
 * Suggested values, stored in English and translated when shown. Anything the user types
 * instead is kept exactly as entered.
 */
export const SOURCES_OF_FUNDS = [
  'Salary',
  'Business income',
  'Freelance work',
  'Bonus',
  'Investment returns',
  'Rental income',
  'Gift',
  'Other',
];

export const PURPOSES = [
  'Emergency',
  'Medical expenses',
  'Education',
  'Household expenses',
  'Travel',
  'Major purchase',
  'Debt repayment',
  'Family support',
  'Other',
];

export const DETAIL_FIELD: Record<
  SavingsEntryType,
  { name: 'source' | 'purpose'; label: string; required: string; suggestions: string[] }
> = {
  DEPOSIT: {
    name: 'source',
    label: 'Source of funds',
    required: 'Enter the source of funds',
    suggestions: SOURCES_OF_FUNDS,
  },
  WITHDRAWAL: {
    name: 'purpose',
    label: 'Purpose',
    required: 'Enter the purpose',
    suggestions: PURPOSES,
  },
};
