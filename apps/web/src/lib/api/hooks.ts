'use client';

import type { ReportGranularity, TransactionType } from '@expense/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n/language-provider';
import { ApiError } from './client';
import {
  budgetsApi,
  categoriesApi,
  dashboardApi,
  loansApi,
  recurringApi,
  reportsApi,
  savingsApi,
  transactionsApi,
  type BudgetInput,
  type CategoryInput,
  type LoanInput,
  type RangeParams,
  type RecurringInput,
  type RepaymentInput,
  type SavingsEntryInput,
  type SavingsHistoryFilters,
  type TransactionFilters,
  type TransactionInput,
} from './endpoints';

export const queryKeys = {
  transactions: (filters: TransactionFilters) => ['transactions', filters] as const,
  transaction: (id: string) => ['transaction', id] as const,
  categories: () => ['categories'] as const,
  budgets: (date?: string) => ['budgets', date ?? 'today'] as const,
  summary: (r: RangeParams) => ['dashboard', 'summary', r] as const,
  trends: (r: RangeParams, g?: ReportGranularity) =>
    ['dashboard', 'trends', r, g ?? 'auto'] as const,
  breakdown: (r: RangeParams, type: TransactionType) =>
    ['dashboard', 'breakdown', r, type] as const,
  reportTransactions: (r: RangeParams, g?: ReportGranularity) =>
    ['reports', 'transactions', r, g ?? 'auto'] as const,
  reportIncomeExpenses: (r: RangeParams, g?: ReportGranularity) =>
    ['reports', 'income-expenses', r, g ?? 'auto'] as const,
  recurring: () => ['recurring'] as const,
  recurringExecutions: (id: string) => ['recurring', id, 'executions'] as const,
  loans: () => ['loans'] as const,
  savings: () => ['savings', 'summary'] as const,
  savingsHistory: (filters: SavingsHistoryFilters) => ['savings', 'history', filters] as const,
};

const FINANCIAL_ROOTS = new Set([
  'transactions',
  'transaction',
  'dashboard',
  'reports',
  'budgets',
  'categories',
  'recurring',
  'loans',
  'savings',
]);

/** Any write can affect totals, budgets and counts, so refresh every financial view. */
export function invalidateFinancialData(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (q) => FINANCIAL_ROOTS.has(String(q.queryKey[0])),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

function useFinancialMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  messages: { success?: string | ((result: TResult) => string); error?: string } = {},
) {
  const { t: tr } = useLanguage();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      void invalidateFinancialData(queryClient);
      if (messages.success) {
        toast.success(
          tr(typeof messages.success === 'function' ? messages.success(result) : messages.success),
        );
      }
    },
    onError: (error) => {
      // Validation errors are shown inline on the form; still surface a toast for context.
      toast.error(tr(messages.error ?? 'Could not save changes'), {
        description: tr(errorMessage(error)),
      });
    },
  });
}

/* Transactions ------------------------------------------------------------- */

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => transactionsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(id: string) {
  return useQuery({ queryKey: queryKeys.transaction(id), queryFn: () => transactionsApi.get(id) });
}

export function useCreateTransaction() {
  const { t: tr } = useLanguage();
  return useFinancialMutation((input: TransactionInput) => transactionsApi.create(input), {
    success: (t) =>
      tr('{type} "{title}" added', {
        type: tr(t.type === 'INCOME' ? 'Income' : 'Expense'),
        title: t.title,
      }),
    error: 'Could not add transaction',
  });
}

export function useUpdateTransaction() {
  return useFinancialMutation(
    ({ id, input }: { id: string; input: Partial<TransactionInput> }) =>
      transactionsApi.update(id, input),
    { success: 'Transaction updated', error: 'Could not update transaction' },
  );
}

export function useDeleteTransaction() {
  return useFinancialMutation((id: string) => transactionsApi.remove(id), {
    success: 'Transaction deleted',
    error: 'Could not delete transaction',
  });
}

/* Categories --------------------------------------------------------------- */

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => categoriesApi.list(),
    staleTime: 60_000,
  });
}

export function useSaveCategory() {
  const { t: tr } = useLanguage();
  return useFinancialMutation(
    ({ id, input }: { id?: string; input: CategoryInput }) =>
      id ? categoriesApi.update(id, input) : categoriesApi.create(input),
    {
      success: (c) => tr('Category "{name}" saved', { name: c.name }),
      error: 'Could not save category',
    },
  );
}

export function useDeleteCategory() {
  const { t: tr } = useLanguage();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      categoriesApi.remove(id, reassignTo),
    onSuccess: () => {
      void invalidateFinancialData(queryClient);
      toast.success(tr('Category deleted'));
    },
  });
}

/* Budgets ------------------------------------------------------------------ */

export function useBudgets(date?: string) {
  return useQuery({ queryKey: queryKeys.budgets(date), queryFn: () => budgetsApi.list(date) });
}

export function useSaveBudget() {
  return useFinancialMutation(
    ({ id, input }: { id?: string; input: BudgetInput }) =>
      id ? budgetsApi.update(id, input) : budgetsApi.create(input),
    { success: 'Budget saved', error: 'Could not save budget' },
  );
}

export function useDeleteBudget() {
  return useFinancialMutation((id: string) => budgetsApi.remove(id), {
    success: 'Budget deleted',
    error: 'Could not delete budget',
  });
}

/* Dashboard & reports ------------------------------------------------------ */

const rangeReady = (r: RangeParams) =>
  r.range !== 'custom' || Boolean(r.from && r.to && r.from <= r.to);

export function useDashboardSummary(r: RangeParams) {
  return useQuery({
    queryKey: queryKeys.summary(r),
    queryFn: () => dashboardApi.summary(r),
    enabled: rangeReady(r),
    placeholderData: keepPreviousData,
  });
}

export function useSpendingTrends(r: RangeParams, granularity?: ReportGranularity) {
  return useQuery({
    queryKey: queryKeys.trends(r, granularity),
    queryFn: () => dashboardApi.trends(r, granularity),
    enabled: rangeReady(r),
    placeholderData: keepPreviousData,
  });
}

export function useCategoryBreakdown(r: RangeParams, type: TransactionType = 'EXPENSE') {
  return useQuery({
    queryKey: queryKeys.breakdown(r, type),
    queryFn: () => dashboardApi.categoryBreakdown(r, type),
    enabled: rangeReady(r),
    placeholderData: keepPreviousData,
  });
}

export function useTransactionReport(r: RangeParams, granularity?: ReportGranularity) {
  return useQuery({
    queryKey: queryKeys.reportTransactions(r, granularity),
    queryFn: () => reportsApi.transactions(r, granularity),
    enabled: rangeReady(r),
    placeholderData: keepPreviousData,
  });
}

export function useIncomeExpenseReport(r: RangeParams, granularity?: ReportGranularity) {
  return useQuery({
    queryKey: queryKeys.reportIncomeExpenses(r, granularity),
    queryFn: () => reportsApi.incomeExpenses(r, granularity),
    enabled: rangeReady(r),
    placeholderData: keepPreviousData,
  });
}

/* Recurring ---------------------------------------------------------------- */

export function useRecurring() {
  return useQuery({ queryKey: queryKeys.recurring(), queryFn: () => recurringApi.list() });
}

export function useRecurringExecutions(id: string | null) {
  return useQuery({
    queryKey: queryKeys.recurringExecutions(id ?? ''),
    queryFn: () => recurringApi.executions(id!),
    enabled: Boolean(id),
  });
}

export function useSaveRecurring() {
  const { t: tr } = useLanguage();
  return useFinancialMutation(
    ({ id, input }: { id?: string; input: RecurringInput }) =>
      id ? recurringApi.update(id, input) : recurringApi.create(input),
    {
      success: (r) =>
        r.executionCount > 0
          ? tr('Schedule saved · {count} transaction(s) generated', { count: r.executionCount })
          : 'Schedule saved',
      error: 'Could not save schedule',
    },
  );
}

export function useToggleRecurring() {
  const { t: tr } = useLanguage();
  return useFinancialMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      active ? recurringApi.resume(id) : recurringApi.pause(id),
    {
      success: (r) =>
        r.isActive
          ? tr('"{title}" resumed', { title: r.title })
          : tr('"{title}" paused', { title: r.title }),
      error: 'Could not update schedule',
    },
  );
}

export function useDeleteRecurring() {
  return useFinancialMutation((id: string) => recurringApi.remove(id), {
    success: 'Schedule deleted',
    error: 'Could not delete schedule',
  });
}

/* Loans -------------------------------------------------------------------- */

export function useLoans() {
  return useQuery({ queryKey: queryKeys.loans(), queryFn: () => loansApi.overview() });
}

export function useSaveLoan() {
  return useFinancialMutation(
    ({ id, input }: { id?: string; input: LoanInput }) =>
      id ? loansApi.update(id, input) : loansApi.create(input),
    { success: 'Loan saved', error: 'Could not save loan' },
  );
}

export function useDeleteLoan() {
  return useFinancialMutation((id: string) => loansApi.remove(id), {
    success: 'Loan deleted',
    error: 'Could not delete loan',
  });
}

export function useRepayLoan() {
  return useFinancialMutation(
    ({ id, input }: { id: string; input: RepaymentInput }) => loansApi.repay(id, input),
    {
      success: (loan) => (loan.status === 'paid' ? 'Loan fully repaid' : 'Repayment recorded'),
      error: 'Could not record repayment',
    },
  );
}

export function useDeleteRepayment() {
  return useFinancialMutation(
    ({ id, repaymentId }: { id: string; repaymentId: string }) =>
      loansApi.removeRepayment(id, repaymentId),
    { success: 'Repayment removed', error: 'Could not remove repayment' },
  );
}

/* Savings ------------------------------------------------------------------ */

export function useSavingsSummary() {
  return useQuery({ queryKey: queryKeys.savings(), queryFn: () => savingsApi.summary() });
}

export function useSavingsHistory(filters: SavingsHistoryFilters) {
  return useQuery({
    queryKey: queryKeys.savingsHistory(filters),
    queryFn: () => savingsApi.entries(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAddSavingsEntry() {
  return useFinancialMutation((input: SavingsEntryInput) => savingsApi.add(input), {
    success: (entry) => (entry.type === 'DEPOSIT' ? 'Added to savings' : 'Taken out of savings'),
    error: 'Could not update savings',
  });
}

export function useDeleteSavingsEntry() {
  return useFinancialMutation((id: string) => savingsApi.remove(id), {
    success: 'Entry removed',
    error: 'Could not remove entry',
  });
}
