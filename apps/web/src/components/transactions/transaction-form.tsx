'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type Transaction,
  type TransactionType,
} from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { CategoryBudgetCard } from '@/components/budgets/category-budget-card';
import { CategoryIcon } from '@/components/common/category-icon';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import type { TransactionInput } from '@/lib/api/endpoints';
import { useCategories } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  title: z.string().trim().min(1, 'Enter a title').max(120, 'Keep the title under 120 characters'),
  amount: z
    .string()
    .trim()
    .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
  categoryId: z.string().min(1, 'Choose a category'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(1000, 'Notes are limited to 1000 characters'),
  tags: z
    .string()
    .trim()
    .refine((v) => parseTags(v).length <= 10, 'Use at most 10 tags')
    .refine(
      (v) => parseTags(v).every((t) => t.length <= 30),
      'Each tag must be 30 characters or less',
    ),
});

export type TransactionFormValues = z.infer<typeof schema>;

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function TransactionTypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
}) {
  const { t: tr } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={tr('Transaction type')}
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {(['EXPENSE', 'INCOME'] as const).map((type) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={value === type}
          onClick={() => onChange(type)}
          className={cn(
            'h-8 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            value === type
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {type === 'EXPENSE' ? tr('Expense') : tr('Income')}
        </button>
      ))}
    </div>
  );
}

export { FieldError };

export function TransactionForm({
  transaction,
  defaultType = 'EXPENSE',
  submitLabel,
  onSubmit,
  onCancel,
}: {
  transaction?: Transaction;
  defaultType?: TransactionType;
  submitLabel?: string;
  onSubmit: (input: TransactionInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const categories = useCategories();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? defaultType,
      title: transaction?.title ?? '',
      amount: transaction?.amount ?? '',
      categoryId: transaction?.category.id ?? '',
      date: transaction?.date ?? todayIn(user.timezone),
      paymentMethod: transaction?.paymentMethod ?? 'CASH',
      notes: transaction?.notes ?? '',
      tags: transaction?.tags.join(', ') ?? '',
    },
  });
  const { register, control, handleSubmit, formState, setValue, setError } = form;
  const [type, categoryId, date, amount] = useWatch({
    control,
    name: ['type', 'categoryId', 'date', 'amount'],
  });
  const options = (categories.data ?? []).filter((c) => c.type === type);
  const selectedCategory =
    type === 'EXPENSE' ? options.find((c) => c.id === categoryId) : undefined;

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({
        type: values.type,
        title: values.title,
        amount: values.amount,
        categoryId: values.categoryId,
        date: values.date,
        paymentMethod: values.paymentMethod,
        notes: values.notes || null,
        tags: parseTags(values.tags),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field in values) setError(field as keyof TransactionFormValues, { message });
        }
      }
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TransactionTypeToggle
        value={type}
        onChange={(next) => {
          setValue('type', next);
          const current = form.getValues('categoryId');
          if (current && !categories.data?.some((c) => c.id === current && c.type === next)) {
            setValue('categoryId', '');
          }
        }}
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1.5">
          <Label htmlFor="tx-title">{tr('Title')}</Label>
          <Input
            id="tx-title"
            placeholder={type === 'EXPENSE' ? tr('e.g. Weekly groceries') : tr('e.g. Salary')}
            autoFocus
            aria-invalid={!!formState.errors.title}
            {...register('title')}
          />
          <FieldError message={formState.errors.title?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-amount">
            {tr('Amount (')}
            {user.currency})
          </Label>
          <Input
            id="tx-amount"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular"
            aria-invalid={!!formState.errors.amount}
            {...register('amount')}
          />
          <FieldError message={formState.errors.amount?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-category">{tr('Category')}</Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={categories.isLoading}
              >
                <SelectTrigger id="tx-category" aria-invalid={!!formState.errors.categoryId}>
                  <SelectValue
                    placeholder={categories.isLoading ? tr('Loading…') : tr('Choose a category')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5" />
                      {c.name}
                    </SelectItem>
                  ))}
                  {options.length === 0 && !categories.isLoading && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      {tr('No categories for this type yet.')}{' '}
                    </p>
                  )}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={formState.errors.categoryId?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-date">{tr('Date')}</Label>
          <Input
            id="tx-date"
            type="date"
            aria-invalid={!!formState.errors.date}
            {...register('date')}
          />
          <FieldError message={formState.errors.date?.message} />
        </div>
      </div>

      {selectedCategory && (
        <CategoryBudgetCard
          category={selectedCategory}
          date={date}
          amount={amount}
          original={
            transaction && {
              categoryId: transaction.category.id,
              date: transaction.date,
              amount: transaction.amount,
              type: transaction.type,
            }
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tx-method">{tr('Payment method')}</Label>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="tx-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {tr(PAYMENT_METHOD_LABELS[m])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-tags">
            {tr('Tags')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Input
            id="tx-tags"
            placeholder={tr('family, weekly')}
            aria-invalid={!!formState.errors.tags}
            {...register('tags')}
          />
          <FieldError message={formState.errors.tags?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-notes">
          {tr('Notes')}{' '}
          <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
        </Label>
        <Textarea
          id="tx-notes"
          rows={2}
          placeholder={tr('Anything worth remembering')}
          {...register('notes')}
        />
        <FieldError message={formState.errors.notes?.message} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tr('Cancel')}{' '}
          </Button>
        )}
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel ??
            (transaction
              ? tr('Save changes')
              : tr('Add {v0}', { v0: tr(type === 'EXPENSE' ? 'expense' : 'income') }))}
        </Button>
      </div>
    </form>
  );
}
