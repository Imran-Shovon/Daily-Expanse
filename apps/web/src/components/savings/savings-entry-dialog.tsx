'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { SavingsEntryType } from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FieldError } from '@/components/common/field-error';
import { useFormatters } from '@/components/common/money';
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
import { ApiError } from '@/lib/api/client';
import { useAddSavingsEntry } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DETAIL_FIELD } from './savings-labels';

/** Compares 2-decimal money strings exactly by converting to integer cents. */
const cents = (amount: string) => Math.round(Number(amount) * 100);

function schemaFor(balance: string, today: string) {
  return z
    .object({
      type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
      amount: z
        .string()
        .trim()
        .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
      date: z
        .string()
        .min(1, 'Choose a date')
        .refine((v) => v <= today, 'Savings entries cannot be dated in the future'),
      detail: z.string().trim().max(80, 'Keep this under 80 characters'),
      notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
    })
    .superRefine((v, ctx) => {
      if (!v.detail) {
        ctx.addIssue({ code: 'custom', path: ['detail'], message: DETAIL_FIELD[v.type].required });
      }
    })
    .refine(
      (v) => v.type === 'DEPOSIT' || !isValidAmount(v.amount) || cents(v.amount) <= cents(balance),
      { path: ['amount'], message: 'That is more than you have in savings' },
    );
}

type Values = z.infer<ReturnType<typeof schemaFor>>;

const OPTIONS = [
  { value: 'DEPOSIT', label: 'Add money', icon: ArrowDownToLine },
  { value: 'WITHDRAWAL', label: 'Take out', icon: ArrowUpFromLine },
] as const;

export function SavingsEntryDialog({
  type,
  balance,
  onOpenChange,
}: {
  /** Which way the money moves; null when closed. */
  type: SavingsEntryType | null;
  /** Current savings balance, the most that can be taken out. */
  balance: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr('Savings')}</DialogTitle>
          <DialogDescription>
            {tr('You have {v0} in savings.', { v0: money(balance) })}
          </DialogDescription>
        </DialogHeader>
        {type && (
          <EntryForm
            key={type}
            initialType={type}
            balance={balance}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  initialType,
  balance,
  onDone,
}: {
  initialType: SavingsEntryType;
  balance: string;
  onDone: () => void;
}) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const { money } = useFormatters();
  const add = useAddSavingsEntry();
  const today = todayIn(user.timezone);
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<Values>({
    resolver: zodResolver(schemaFor(balance, today)),
    defaultValues: { type: initialType, amount: '', date: today, detail: '', notes: '' },
  });
  const [type, detail] = useWatch({ control, name: ['type', 'detail'] });
  const isWithdrawal = type === 'WITHDRAWAL';
  const detailField = DETAIL_FIELD[type];
  // A picked suggestion is stored in English; the input shows it in the current language.
  const canonical = (value: string) =>
    detailField.suggestions.find((s) => tr(s) === value.trim()) ?? value.trim();
  const canTakeAll = isWithdrawal && cents(balance) > 0;

  const submit = handleSubmit(async (v) => {
    try {
      await add.mutateAsync({
        type: v.type,
        amount: v.amount,
        date: v.date,
        [DETAIL_FIELD[v.type].name]: canonical(v.detail),
        notes: v.notes || null,
      });
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        const detailError = fields[DETAIL_FIELD[v.type].name];
        if (detailError) setError('detail', { message: detailError });
        else if (/date/i.test(error.message)) setError('date', { message: error.message });
        else setError('amount', { message: fields.amount ?? error.message });
      }
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <div
            role="radiogroup"
            aria-label={tr('Direction')}
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={field.value === option.value}
                onClick={() => {
                  if (field.value !== option.value) setValue('detail', '');
                  field.onChange(option.value);
                }}
                className={cn(
                  'flex h-8 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  field.value === option.value && 'bg-card text-foreground shadow-xs',
                )}
              >
                <option.icon className="size-4" />
                {tr(option.label)}
              </button>
            ))}
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="s-amount">
              {tr('Amount (')}
              {user.currency})
            </Label>
            {canTakeAll && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() =>
                  setValue('amount', balance, { shouldValidate: true, shouldDirty: true })
                }
              >
                {tr('Take out all')}
              </button>
            )}
          </div>
          <Input
            id="s-amount"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular"
            autoFocus
            aria-invalid={!!formState.errors.amount}
            {...register('amount')}
          />
          <FieldError message={formState.errors.amount?.message} />
          {isWithdrawal && !formState.errors.amount && (
            <p className="text-xs text-muted-foreground">
              {tr('Available: {v0}', { v0: money(balance) })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-date">{tr('Date')}</Label>
          <Input
            id="s-date"
            type="date"
            max={today}
            aria-invalid={!!formState.errors.date}
            {...register('date')}
          />
          <FieldError message={formState.errors.date?.message} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-detail">{tr(detailField.label)}</Label>
        <Input
          id="s-detail"
          placeholder={tr('Choose below or type your own')}
          aria-invalid={!!formState.errors.detail}
          {...register('detail')}
        />
        <div className="flex flex-wrap gap-1.5" aria-label={tr('Suggestions')}>
          {detailField.suggestions.map((suggestion) => {
            const selected = detail.trim() === tr(suggestion);
            return (
              <button
                key={suggestion}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setValue('detail', tr(suggestion), { shouldValidate: true, shouldDirty: true })
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected && 'border-primary/40 bg-accent text-accent-foreground hover:bg-accent',
                )}
              >
                {tr(suggestion)}
              </button>
            );
          })}
        </div>
        <FieldError message={formState.errors.detail?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-notes">
          {tr('Notes')}{' '}
          <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
        </Label>
        <Input
          id="s-notes"
          placeholder={isWithdrawal ? tr('e.g. Phone repair') : tr('e.g. October salary')}
          {...register('notes')}
        />
        <FieldError message={formState.errors.notes?.message} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {isWithdrawal ? tr('Take out money') : tr('Add money')}
        </Button>
      </div>
    </form>
  );
}
