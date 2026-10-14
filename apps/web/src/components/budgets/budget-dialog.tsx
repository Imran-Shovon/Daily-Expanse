'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { BUDGET_PERIOD_LABELS, BUDGET_PERIODS, type Budget } from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CategoryIcon } from '@/components/common/category-icon';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { useCategories, useSaveBudget } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount } from '@/lib/format';

const OVERALL = 'overall';

const schema = z
  .object({
    name: z.string().trim().max(80, 'Keep the name under 80 characters'),
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
    scope: z.string().min(1),
    period: z.enum(BUDGET_PERIODS),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  });

type Values = z.infer<typeof schema>;

export function BudgetDialog({
  open,
  onOpenChange,
  budget,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
  /** Pre-selects a category when creating a budget from a category context. */
  defaultCategoryId?: string;
}) {
  const { t: tr } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? tr('Edit budget') : tr('New budget')}</DialogTitle>
          <DialogDescription>
            {tr(
              'Budgets track expenses only. Income never counts against a budget, and budgets never change your balance.',
            )}{' '}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BudgetForm
            key={budget?.id ?? 'new'}
            budget={budget}
            defaultCategoryId={defaultCategoryId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({
  budget,
  defaultCategoryId,
  onDone,
}: {
  budget?: Budget;
  defaultCategoryId?: string;
  onDone: () => void;
}) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const categories = useCategories();
  const save = useSaveBudget();
  const expenseCategories = (categories.data ?? []).filter((c) => c.type === 'EXPENSE');
  const { register, control, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: budget?.name ?? '',
      amount: budget?.amount ?? '',
      scope: budget?.category?.id ?? defaultCategoryId ?? OVERALL,
      period: budget?.period ?? 'MONTHLY',
      startDate: budget?.startDate ?? '',
      endDate: budget?.endDate ?? '',
    },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: budget?.id,
        input: {
          name: v.name || null,
          amount: v.amount,
          period: v.period,
          categoryId: v.scope === OVERALL ? null : v.scope,
          ...(v.startDate ? { startDate: v.startDate } : {}),
          endDate: v.endDate || null,
        },
      });
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.amount) setError('amount', { message: fields.amount });
        if (error.status === 409) setError('scope', { message: error.message });
      }
    }
  });

  return (
    <form
      // The dialog can open from inside another form (e.g. the expense form); React events
      // bubble through portals, so keep this submit from reaching the outer form.
      onSubmit={(e) => {
        e.stopPropagation();
        void submit(e);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="b-scope">{tr('Applies to')}</Label>
        <Controller
          control={control}
          name="scope"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="b-scope" aria-invalid={!!formState.errors.scope}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OVERALL}>{tr('All expenses (overall budget)')}</SelectItem>
                <SelectSeparator />
                {expenseCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" className="size-5" />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.scope?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-amount">
            {tr('Limit (')}
            {user.currency})
          </Label>
          <Input
            id="b-amount"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular"
            aria-invalid={!!formState.errors.amount}
            {...register('amount')}
          />
          <FieldError message={formState.errors.amount?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-period">{tr('Period')}</Label>
          <Controller
            control={control}
            name="period"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="b-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {tr(BUDGET_PERIOD_LABELS[p])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="b-name">
          {tr('Name')} <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
        </Label>
        <Input id="b-name" placeholder={tr('e.g. Household spending')} {...register('name')} />
        <FieldError message={formState.errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-start">
            {tr('Start date')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Input id="b-start" type="date" {...register('startDate')} />
          <p className="text-xs text-muted-foreground">
            {tr('Periods repeat from this date. Defaults to the current period.')}{' '}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-end">
            {tr('End date')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Input
            id="b-end"
            type="date"
            aria-invalid={!!formState.errors.endDate}
            {...register('endDate')}
          />
          <FieldError message={formState.errors.endDate?.message} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}{' '}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {budget ? tr('Save changes') : tr('Create budget')}
        </Button>
      </div>
    </form>
  );
}
