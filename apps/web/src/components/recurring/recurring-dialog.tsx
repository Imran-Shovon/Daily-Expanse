'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  RECURRENCE_FREQUENCIES,
  type RecurringTransaction,
} from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { CategoryIcon } from '@/components/common/category-icon';
import { FieldError } from '@/components/common/field-error';
import { TransactionTypeToggle } from '@/components/transactions/transaction-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories, useSaveRecurring } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { translate, type Language } from '@/lib/i18n/translate';

const UNIT: Record<(typeof RECURRENCE_FREQUENCIES)[number], [string, string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  YEARLY: ['year', 'years'],
};

export function describeFrequency(
  frequency: (typeof RECURRENCE_FREQUENCIES)[number],
  interval: number,
  language: Language = 'en',
) {
  const [one, many] = UNIT[frequency];
  return interval === 1
    ? translate(language, 'Every {v0}', { v0: translate(language, one) })
    : translate(language, 'Every {v0} {v1}', { v0: interval, v1: translate(language, many) });
}

const schema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']),
    title: z
      .string()
      .trim()
      .min(1, 'Enter a title')
      .max(120, 'Keep the title under 120 characters'),
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
    categoryId: z.string().min(1, 'Choose a category'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z
      .string()
      .regex(/^\d+$/, 'Whole number')
      .refine((v) => Number(v) >= 1 && Number(v) <= 365, 'Between 1 and 365'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    endDate: z.string(),
    notes: z.string().trim().max(1000, 'Notes are limited to 1000 characters'),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date must be after the start date',
  });

type Values = z.infer<typeof schema>;

export function RecurringDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RecurringTransaction;
}) {
  const { t: tr } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {item ? tr('Edit recurring transaction') : tr('New recurring transaction')}
          </DialogTitle>
          <DialogDescription>
            {tr(
              'Transactions are created automatically on each due date. Past dates since the start are filled in right away.',
            )}{' '}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RecurringForm key={item?.id ?? 'new'} item={item} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({ item, onDone }: { item?: RecurringTransaction; onDone: () => void }) {
  const { t: tr, language } = useLanguage();
  const user = useUser();
  const categories = useCategories();
  const save = useSaveRecurring();
  const { register, control, handleSubmit, formState, setValue, getValues } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: item?.type ?? 'EXPENSE',
      title: item?.title ?? '',
      amount: item?.amount ?? '',
      categoryId: item?.category.id ?? '',
      paymentMethod: item?.paymentMethod ?? 'BANK_TRANSFER',
      frequency: item?.frequency ?? 'MONTHLY',
      interval: String(item?.interval ?? 1),
      startDate: item?.startDate ?? todayIn(user.timezone),
      endDate: item?.endDate ?? '',
      notes: item?.notes ?? '',
    },
  });
  const [type, frequency, interval] = useWatch({
    control,
    name: ['type', 'frequency', 'interval'],
  });
  const options = (categories.data ?? []).filter((c) => c.type === type);

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: item?.id,
        input: {
          type: v.type,
          title: v.title,
          amount: v.amount,
          categoryId: v.categoryId,
          paymentMethod: v.paymentMethod,
          frequency: v.frequency,
          interval: Number(v.interval),
          startDate: v.startDate,
          endDate: v.endDate || null,
          notes: v.notes || null,
        },
      });
      onDone();
    } catch {
      // toast shown by the mutation
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TransactionTypeToggle
        value={type}
        onChange={(next) => {
          setValue('type', next);
          if (!categories.data?.some((c) => c.id === getValues('categoryId') && c.type === next))
            setValue('categoryId', '');
        }}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div className="space-y-1.5">
          <Label htmlFor="r-title">{tr('Title')}</Label>
          <Input
            id="r-title"
            placeholder={tr('e.g. Rent, Netflix, Salary')}
            autoFocus
            aria-invalid={!!formState.errors.title}
            {...register('title')}
          />
          <FieldError message={formState.errors.title?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-amount">
            {tr('Amount (')}
            {user.currency})
          </Label>
          <Input
            id="r-amount"
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
          <Label htmlFor="r-category">{tr('Category')}</Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="r-category" aria-invalid={!!formState.errors.categoryId}>
                  <SelectValue placeholder={tr('Choose a category')} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5" />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={formState.errors.categoryId?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-method">{tr('Payment method')}</Label>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="r-method">
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="r-interval">{tr('Repeats')}</Label>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <Input
            id="r-interval"
            inputMode="numeric"
            aria-label={tr('Interval')}
            aria-invalid={!!formState.errors.interval}
            {...register('interval')}
          />
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label={tr('Frequency')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {tr(Number(interval) === 1 ? UNIT[f][0] : UNIT[f][1])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formState.errors.interval ? (
            <span className="text-destructive">{tr(formState.errors.interval.message ?? '')}</span>
          ) : (
            describeFrequency(frequency, Math.max(1, Number(interval) || 1), language)
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="r-start">{tr('Start date')}</Label>
          <Input
            id="r-start"
            type="date"
            aria-invalid={!!formState.errors.startDate}
            {...register('startDate')}
          />
          <FieldError message={formState.errors.startDate?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-end">
            {tr('End date')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Input
            id="r-end"
            type="date"
            aria-invalid={!!formState.errors.endDate}
            {...register('endDate')}
          />
          <FieldError message={formState.errors.endDate?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="r-notes">
          {tr('Notes')}{' '}
          <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
        </Label>
        <Textarea id="r-notes" rows={2} {...register('notes')} />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}{' '}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {item ? tr('Save changes') : tr('Create schedule')}
        </Button>
      </div>
    </form>
  );
}
