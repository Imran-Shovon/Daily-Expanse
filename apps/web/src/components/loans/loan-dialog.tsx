'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { LOAN_DIRECTIONS, type Loan, type LoanDirection } from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FieldError } from '@/components/common/field-error';
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
import { ApiError } from '@/lib/api/client';
import { useSaveLoan } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LOAN_COPY } from './loan-copy';

const schema = z
  .object({
    direction: z.enum(LOAN_DIRECTIONS),
    counterparty: z.string().trim().max(80, 'Keep the name under 80 characters'),
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
    loanDate: z.string().min(1, 'Choose a date'),
    dueDate: z.string(),
    notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
  })
  .superRefine((v, ctx) => {
    if (!v.counterparty) {
      ctx.addIssue({
        code: 'custom',
        path: ['counterparty'],
        message: LOAN_COPY[v.direction].counterpartyRequired,
      });
    }
    if (v.dueDate && v.dueDate < v.loanDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'The due date must be on or after the loan date',
      });
    }
  });

type Values = z.infer<typeof schema>;

const DIRECTION_OPTIONS = [
  { value: 'BORROWED', label: 'I borrowed', icon: ArrowDownLeft },
  { value: 'LENT', label: 'I lent', icon: ArrowUpRight },
] as const;

export function LoanDialog({
  open,
  onOpenChange,
  loan,
  defaultDirection = 'BORROWED',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan?: Loan;
  /** Side a new loan starts on, e.g. the tab the user is looking at. */
  defaultDirection?: LoanDirection;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <LoanForm
            key={loan?.id ?? `new-${defaultDirection}`}
            loan={loan}
            defaultDirection={defaultDirection}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoanForm({
  loan,
  defaultDirection,
  onDone,
}: {
  loan?: Loan;
  defaultDirection: LoanDirection;
  onDone: () => void;
}) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const save = useSaveLoan();
  const { register, control, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: loan?.direction ?? defaultDirection,
      counterparty: loan?.counterparty ?? '',
      amount: loan?.amount ?? '',
      loanDate: loan?.loanDate ?? todayIn(user.timezone),
      dueDate: loan?.dueDate ?? '',
      notes: loan?.notes ?? '',
    },
  });
  const direction = useWatch({ control, name: 'direction' });
  const copy = LOAN_COPY[direction];

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: loan?.id,
        input: {
          // The side of a loan is fixed once recorded.
          ...(loan ? {} : { direction: v.direction }),
          counterparty: v.counterparty,
          amount: v.amount,
          loanDate: v.loanDate,
          dueDate: v.dueDate || null,
          notes: v.notes || null,
        },
      });
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.counterparty) setError('counterparty', { message: fields.counterparty });
        if (fields.amount) setError('amount', { message: fields.amount });
        if (/amount/i.test(error.message)) setError('amount', { message: error.message });
        else if (/loan date/i.test(error.message) && !/due date/i.test(error.message)) {
          setError('loanDate', { message: error.message });
        } else if (/due date/i.test(error.message)) {
          setError('dueDate', { message: error.message });
        }
      }
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{loan ? tr('Edit loan') : tr(copy.newTitle)}</DialogTitle>
        <DialogDescription>{tr(copy.dialogDescription)}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!loan && (
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label={tr('Loan type')}
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option.value}
                    onClick={() => field.onChange(option.value)}
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
        )}

        <div className="space-y-1.5">
          <Label htmlFor="l-counterparty">{tr(copy.counterpartyLabel)}</Label>
          <Input
            id="l-counterparty"
            placeholder={tr(copy.counterpartyPlaceholder)}
            aria-invalid={!!formState.errors.counterparty}
            autoFocus
            {...register('counterparty')}
          />
          <FieldError message={formState.errors.counterparty?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-amount">
              {tr('Amount (')}
              {user.currency})
            </Label>
            <Input
              id="l-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              aria-invalid={!!formState.errors.amount}
              {...register('amount')}
            />
            <FieldError message={formState.errors.amount?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-date">{tr(copy.dateLabel)}</Label>
            <Input
              id="l-date"
              type="date"
              aria-invalid={!!formState.errors.loanDate}
              {...register('loanDate')}
            />
            <FieldError message={formState.errors.loanDate?.message} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="l-due">
            {tr('Due date')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Input
            id="l-due"
            type="date"
            aria-invalid={!!formState.errors.dueDate}
            {...register('dueDate')}
          />
          <FieldError message={formState.errors.dueDate?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="l-notes">
            {tr('Notes')}{' '}
            <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
          </Label>
          <Textarea id="l-notes" rows={2} {...register('notes')} />
          <FieldError message={formState.errors.notes?.message} />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onDone}>
            {tr('Cancel')}
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {loan ? tr('Save changes') : tr('Add loan')}
          </Button>
        </div>
      </form>
    </>
  );
}
