import type {
  BudgetPeriod,
  DateFormat,
  DateRangePreset,
  LoanDirection,
  PaymentMethod,
  RecurrenceFrequency,
  ReportGranularity,
  SavingsEntryType,
  Theme,
  TransactionType,
} from './constants';

/**
 * Monetary amounts always travel as decimal strings (e.g. "1234.50") so no
 * precision is lost between PostgreSQL NUMERIC and the client.
 */
export type Money = string;

/** Calendar dates travel as ISO dates without a time component: "2026-10-13". */
export type IsoDate = string;

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  timezone: string;
  dateFormat: DateFormat;
  theme: Theme;
  defaultDateRange: DateRangePreset;
  /** False for accounts created with Google that have not set a password yet. */
  hasPassword: boolean;
  /** True once the account has signed in with Google. */
  googleLinked: boolean;
  createdAt: string;
}

/** Sign-in methods the server has configured. */
export interface AuthProviders {
  google: boolean;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface CategorySummary {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
}

export interface Category extends CategorySummary {
  isDefault: boolean;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  title: string;
  amount: Money;
  type: TransactionType;
  date: IsoDate;
  paymentMethod: PaymentMethod;
  notes: string | null;
  tags: string[];
  category: CategorySummary;
  recurringTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BudgetState = 'ok' | 'warning' | 'exceeded';

export interface BudgetStatus {
  periodStart: IsoDate;
  periodEnd: IsoDate;
  spent: Money;
  remaining: Money;
  /** Percentage of the budget used, rounded to 1 decimal place. */
  percentUsed: number;
  state: BudgetState;
}

export interface Budget {
  id: string;
  name: string | null;
  amount: Money;
  period: BudgetPeriod;
  startDate: IsoDate;
  endDate: IsoDate | null;
  category: CategorySummary | null;
  /** Null when the budget is not active on the reference date. */
  status: BudgetStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  title: string;
  amount: Money;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  notes: string | null;
  tags: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: IsoDate;
  endDate: IsoDate | null;
  /** Null once the schedule has finished (past its end date). */
  nextRunDate: IsoDate | null;
  lastRunDate: IsoDate | null;
  isActive: boolean;
  category: CategorySummary;
  executionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExecution {
  id: string;
  scheduledDate: IsoDate;
  transactionId: string | null;
  createdAt: string;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export interface BudgetAlert {
  budgetId: string;
  name: string;
  categoryName: string | null;
  percentUsed: number;
  state: 'warning' | 'exceeded';
  spent: Money;
  amount: Money;
}

export interface DashboardSummary {
  range: DateRange;
  totalIncome: Money;
  totalExpenses: Money;
  /** Income minus expenses within the selected period (not an account balance). */
  netBalance: Money;
  /** All recorded income minus all recorded expenses up to and including `range.to`. */
  cumulativeBalance: Money;
  /** Null when there is no income in the period. */
  savingsRate: number | null;
  transactionCount: number;
  monthlyBudget: {
    budgetId: string;
    amount: Money;
    status: BudgetStatus;
  } | null;
  budgetAlerts: BudgetAlert[];
  recentTransactions: Transaction[];
}

export interface TrendPoint {
  /** Bucket start date. */
  date: IsoDate;
  label: string;
  income: Money;
  expenses: Money;
  net: Money;
}

export interface SpendingTrends {
  range: DateRange;
  granularity: ReportGranularity;
  points: TrendPoint[];
}

export interface CategoryBreakdownItem {
  category: CategorySummary;
  total: Money;
  percentage: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  range: DateRange;
  type: TransactionType;
  total: Money;
  items: CategoryBreakdownItem[];
}

export interface TransactionReport {
  range: DateRange;
  granularity: ReportGranularity;
  totals: { income: Money; expenses: Money; net: Money; count: number };
  periods: TrendPoint[];
  largestExpenses: Transaction[];
  largestIncome: Transaction[];
  averageDailyExpense: Money;
}

export interface IncomeExpensePoint extends TrendPoint {
  savingsRate: number | null;
  cumulativeNet: Money;
}

export interface IncomeExpenseReport {
  range: DateRange;
  granularity: ReportGranularity;
  points: IncomeExpensePoint[];
  totals: { income: Money; expenses: Money; net: Money; savingsRate: number | null };
}

/** `paid` once repayments cover the amount; `overdue` when unpaid past the due date. */
export type LoanStatus = 'active' | 'overdue' | 'paid';

export interface LoanRepayment {
  id: string;
  amount: Money;
  paidOn: IsoDate;
  notes: string | null;
  createdAt: string;
}

export interface Loan {
  id: string;
  direction: LoanDirection;
  /** Who you borrowed from, or who you lent to. */
  counterparty: string;
  amount: Money;
  /** Day the money changed hands. */
  loanDate: IsoDate;
  dueDate: IsoDate | null;
  notes: string | null;
  /** Repaid to the lender (borrowed) or collected from the borrower (lent). */
  repaid: Money;
  outstanding: Money;
  /** Percentage of the amount repaid, rounded to 1 decimal place. */
  percentRepaid: number;
  status: LoanStatus;
  /** Newest first. */
  repayments: LoanRepayment[];
  createdAt: string;
  updatedAt: string;
}

export interface LoanTotals {
  amount: Money;
  repaid: Money;
  outstanding: Money;
  activeCount: number;
  overdueCount: number;
}

export interface LoansOverview {
  /** BORROWED totals are what you owe; LENT totals are what others owe you. */
  totals: Record<LoanDirection, LoanTotals>;
  loans: Loan[];
}

export interface SavingsEntry {
  id: string;
  type: SavingsEntryType;
  amount: Money;
  date: IsoDate;
  /** Where the money came from; set on deposits. */
  source: string | null;
  /** What the money was used for; set on withdrawals. */
  purpose: string | null;
  notes: string | null;
  /** Savings balance right after this entry, in date order. */
  balanceAfter: Money;
  createdAt: string;
}

export interface SavingsSummary {
  balance: Money;
  totalAdded: Money;
  totalTakenOut: Money;
  /** Entries dated in the current month (user time zone). */
  thisMonth: { added: Money; takenOut: Money };
  entryCount: number;
}
