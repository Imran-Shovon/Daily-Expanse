import type {
  AuthResponse,
  Budget,
  BudgetPeriod,
  Category,
  CategoryBreakdown,
  DashboardSummary,
  DateRangePreset,
  IncomeExpenseReport,
  Paginated,
  PaymentMethod,
  RecurrenceFrequency,
  RecurringExecution,
  RecurringTransaction,
  ReportGranularity,
  SpendingTrends,
  Transaction,
  TransactionReport,
  TransactionType,
  User,
} from '@expense/shared';
import { api, apiRaw, CSRF_HEADER, type QueryValue } from './client';

/** A range selection: a preset, or a custom from/to. */
export interface RangeParams {
  range: DateRangePreset;
  from?: string;
  to?: string;
}

export function rangeQuery(r: RangeParams): Record<string, QueryValue> {
  return r.range === 'custom' ? { from: r.from, to: r.to } : { range: r.range };
}

/* Auth & users ----------------------------------------------------------- */

export const authApi = {
  login: (body: { email: string; password: string }) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    timezone?: string;
    currency?: string;
  }) => api<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
  logout: () =>
    api<void>('/auth/logout', { method: 'POST', auth: false, headers: { [CSRF_HEADER]: '1' } }),
  forgotPassword: (email: string) =>
    api<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  resetPassword: (token: string, password: string) =>
    api<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
      auth: false,
    }),
  me: () => api<User>('/auth/me'),
};

export type ProfileUpdate = Partial<
  Pick<
    User,
    'name' | 'email' | 'currency' | 'timezone' | 'dateFormat' | 'theme' | 'defaultDateRange'
  >
> & { currentPassword?: string };

export const usersApi = {
  update: (body: ProfileUpdate) => api<User>('/users/me', { method: 'PATCH', body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<AuthResponse>('/users/me/password', { method: 'PATCH', body }),
  deleteAccount: (body: { password: string; confirmation: string }) =>
    api<void>('/users/me', { method: 'DELETE', body }),
};

/* Transactions ----------------------------------------------------------- */

export interface TransactionInput {
  title: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  date: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  tags?: string[];
}

export interface TransactionFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: TransactionType;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  tag?: string;
  range?: DateRangePreset;
  from?: string;
  to?: string;
  sortBy?: 'date' | 'amount' | 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export const transactionsApi = {
  list: (filters: TransactionFilters) =>
    api<Paginated<Transaction>>('/transactions', { query: filters as Record<string, QueryValue> }),
  get: (id: string) => api<Transaction>(`/transactions/${encodeURIComponent(id)}`),
  create: (body: TransactionInput) => api<Transaction>('/transactions', { method: 'POST', body }),
  update: (id: string, body: Partial<TransactionInput>) =>
    api<Transaction>(`/transactions/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) =>
    api<void>(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/* Categories ------------------------------------------------------------- */

export interface CategoryInput {
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
}

export const categoriesApi = {
  list: (type?: TransactionType) => api<Category[]>('/categories', { query: { type } }),
  create: (body: CategoryInput) => api<Category>('/categories', { method: 'POST', body }),
  update: (id: string, body: Partial<CategoryInput>) =>
    api<Category>(`/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string, reassignTo?: string) =>
    api<void>(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE', query: { reassignTo } }),
};

/* Budgets ---------------------------------------------------------------- */

export interface BudgetInput {
  name?: string | null;
  amount: string;
  period: BudgetPeriod;
  categoryId: string | null;
  startDate?: string;
  endDate?: string | null;
}

export const budgetsApi = {
  list: (date?: string) => api<Budget[]>('/budgets', { query: { date } }),
  create: (body: BudgetInput) => api<Budget>('/budgets', { method: 'POST', body }),
  update: (id: string, body: Partial<BudgetInput>) =>
    api<Budget>(`/budgets/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) => api<void>(`/budgets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/* Dashboard & reports ---------------------------------------------------- */

export const dashboardApi = {
  summary: (r: RangeParams) =>
    api<DashboardSummary>('/dashboard/summary', { query: rangeQuery(r) }),
  trends: (r: RangeParams, granularity?: ReportGranularity) =>
    api<SpendingTrends>('/dashboard/spending-trends', { query: { ...rangeQuery(r), granularity } }),
  categoryBreakdown: (r: RangeParams, type: TransactionType = 'EXPENSE') =>
    api<CategoryBreakdown>('/dashboard/category-breakdown', { query: { ...rangeQuery(r), type } }),
};

export const reportsApi = {
  transactions: (r: RangeParams, granularity?: ReportGranularity) =>
    api<TransactionReport>('/reports/transactions', { query: { ...rangeQuery(r), granularity } }),
  incomeExpenses: (r: RangeParams, granularity?: ReportGranularity) =>
    api<IncomeExpenseReport>('/reports/income-expenses', {
      query: { ...rangeQuery(r), granularity },
    }),
  /** Downloads the CSV through the authenticated client and saves it as a file. */
  async exportCsv(r: RangeParams, extra: { type?: TransactionType } = {}) {
    const res = await apiRaw('/reports/export', { query: { ...rangeQuery(r), ...extra } });
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'transactions.csv';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  },
};

/* Recurring -------------------------------------------------------------- */

export interface RecurringInput {
  title: string;
  amount: string;
  type: TransactionType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  tags?: string[];
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate?: string | null;
}

export const recurringApi = {
  list: () => api<RecurringTransaction[]>('/recurring-transactions'),
  executions: (id: string) =>
    api<RecurringExecution[]>(`/recurring-transactions/${encodeURIComponent(id)}/executions`),
  create: (body: RecurringInput) =>
    api<RecurringTransaction>('/recurring-transactions', { method: 'POST', body }),
  update: (id: string, body: Partial<RecurringInput> & { isActive?: boolean }) =>
    api<RecurringTransaction>(`/recurring-transactions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    }),
  pause: (id: string) =>
    api<RecurringTransaction>(`/recurring-transactions/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
    }),
  resume: (id: string) =>
    api<RecurringTransaction>(`/recurring-transactions/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    api<void>(`/recurring-transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
