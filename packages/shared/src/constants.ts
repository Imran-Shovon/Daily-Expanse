export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = [
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'BANK_TRANSFER',
  'MOBILE_PAYMENT',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  DEBIT_CARD: 'Debit card',
  CREDIT_CARD: 'Credit card',
  BANK_TRANSFER: 'Bank transfer',
  MOBILE_PAYMENT: 'Mobile payment',
  OTHER: 'Other',
};

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const BUDGET_PERIODS = ['WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'dd MMM yyyy',
  'MMM d, yyyy',
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const DATE_RANGE_PRESETS = [
  'today',
  'this_week',
  'this_month',
  'last_month',
  'this_year',
  'custom',
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  last_month: 'Last month',
  this_year: 'This year',
  custom: 'Custom range',
};

export const REPORT_GRANULARITIES = ['day', 'week', 'month', 'year'] as const;
export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];

/** Icon names map to lucide-react icons on the frontend. */
export const CATEGORY_ICONS = [
  'shopping-cart',
  'car',
  'home',
  'zap',
  'shopping-bag',
  'heart-pulse',
  'graduation-cap',
  'clapperboard',
  'plane',
  'sparkles',
  'repeat',
  'circle-ellipsis',
  'briefcase',
  'laptop',
  'building-2',
  'trending-up',
  'gift',
  'wallet',
  'coffee',
  'utensils',
  'baby',
  'dog',
  'dumbbell',
  'phone',
  'wifi',
  'fuel',
  'book-open',
  'music',
  'shirt',
  'piggy-bank',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_COLORS = [
  '#16a34a',
  '#0d9488',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#c026d3',
  '#db2777',
  '#e11d48',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#57534e',
  '#64748b',
] as const;

export interface DefaultCategory {
  name: string;
  type: TransactionType;
  icon: CategoryIcon;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Food & groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#16a34a' },
  { name: 'Transportation', type: 'EXPENSE', icon: 'car', color: '#2563eb' },
  { name: 'Housing & rent', type: 'EXPENSE', icon: 'home', color: '#7c3aed' },
  { name: 'Utilities & bills', type: 'EXPENSE', icon: 'zap', color: '#d97706' },
  { name: 'Shopping', type: 'EXPENSE', icon: 'shopping-bag', color: '#db2777' },
  { name: 'Healthcare', type: 'EXPENSE', icon: 'heart-pulse', color: '#e11d48' },
  { name: 'Education', type: 'EXPENSE', icon: 'graduation-cap', color: '#4f46e5' },
  { name: 'Entertainment', type: 'EXPENSE', icon: 'clapperboard', color: '#c026d3' },
  { name: 'Travel', type: 'EXPENSE', icon: 'plane', color: '#0891b2' },
  { name: 'Personal care', type: 'EXPENSE', icon: 'sparkles', color: '#ea580c' },
  { name: 'Subscriptions', type: 'EXPENSE', icon: 'repeat', color: '#0d9488' },
  { name: 'Other', type: 'EXPENSE', icon: 'circle-ellipsis', color: '#64748b' },
  { name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#16a34a' },
  { name: 'Freelance', type: 'INCOME', icon: 'laptop', color: '#0d9488' },
  { name: 'Business', type: 'INCOME', icon: 'building-2', color: '#2563eb' },
  { name: 'Investments', type: 'INCOME', icon: 'trending-up', color: '#65a30d' },
  { name: 'Gifts', type: 'INCOME', icon: 'gift', color: '#db2777' },
  { name: 'Other income', type: 'INCOME', icon: 'wallet', color: '#64748b' },
];

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'BDT',
  'INR',
  'PKR',
  'JPY',
  'CNY',
  'AUD',
  'CAD',
  'CHF',
  'SGD',
  'AED',
  'SAR',
  'MYR',
  'NZD',
  'ZAR',
  'BRL',
  'MXN',
  'SEK',
] as const;

/** Budget usage thresholds in percent. */
export const BUDGET_WARNING_THRESHOLD = 80;
export const BUDGET_EXCEEDED_THRESHOLD = 100;

export const SAVINGS_ENTRY_TYPES = ['DEPOSIT', 'WITHDRAWAL'] as const;
export type SavingsEntryType = (typeof SAVINGS_ENTRY_TYPES)[number];

/** BORROWED: you owe the counterparty. LENT: the counterparty owes you. */
export const LOAN_DIRECTIONS = ['BORROWED', 'LENT'] as const;
export type LoanDirection = (typeof LOAN_DIRECTIONS)[number];

/**
 * Where the money for a repayment of borrowed money came from. SALARY records an expense,
 * SAVINGS a savings withdrawal, LOAN a new borrowed loan; OTHER only keeps an explanation.
 */
export const REPAYMENT_SOURCES = [
  'SALARY',
  'SAVINGS',
  'SALARY_AND_SAVINGS',
  'LOAN',
  'OTHER',
] as const;
export type RepaymentSource = (typeof REPAYMENT_SOURCES)[number];
