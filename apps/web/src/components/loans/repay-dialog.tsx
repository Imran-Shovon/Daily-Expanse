'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import {
  REPAYMENT_SOURCES,
  type Loan,
  type LoanRepayment,
  type RepaymentSource,
} from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import type { RepaymentInput } from '@/lib/api/endpoints';
import { useLoans, useRepayLoan, useSavingsSummary, useUpdateRepayment } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LOAN_COPY } from './loan-copy';
import { REPAYMENT_SOURCE_OPTIONS } from './repayment-source';

/** Compares 2-decimal money strings exactly by converting to integer cents. */
const cents = (amount: string) => Math.round(Number(amount) * 100);
const fromCents = (value: number) => (value / 100).toFixed(2);

/** Most this entry may be: what is outstanding, plus the entry's own amount when editing. */
function maxFor(loan: Loan, repayment?: LoanRepayment | null): string {
  return fromCents(cents(loan.outstanding) + (repayment ? cents(repayment.amount) : 0));
}

const SOURCES_USING_SAVINGS: RepaymentSource[] = ['SAVINGS', 'SALARY_AND_SAVINGS'];

interface SchemaContext {
  loan: Loan;
  max: string;
  today: string;
  /** Savings that may be used, or null while the balance is still loading. */
  savingsAvailable: string | null;
  tr: (key: string, values?: Record<string, string | number>) => string;
  money: (amount: string) => string;
}

function schemaFor({ loan, max, today, savingsAvailable, tr, money }: SchemaContext) {
  const amountField = z
    .string()
    .trim()
    .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places');
  return z
    .object({
      amount: amountField.refine(
        (v) => !isValidAmount(v) || cents(v) <= cents(max),
        LOAN_COPY[loan.direction].repayTooMuch,
      ),
      paidOn: z
        .string()
        .min(1, 'Choose a date')
        .refine((v) => v >= loan.loanDate, 'A repayment cannot be dated before the loan date'),
      notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
      source: z.union([z.enum(REPAYMENT_SOURCES), z.literal('')]),
      fromSalary: z.string().trim(),
      fromSavings: z.string().trim(),
      fundingLender: z.string().trim().max(80, 'Keep the name under 80 characters'),
      sourceNote: z.string().trim().max(300, 'Keep this under 300 characters'),
    })
    .superRefine((v, ctx) => {
      // Only repaying borrowed money asks where the money came from.
      if (loan.direction !== 'BORROWED') return;
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      if (!v.source) return issue('source', tr('Choose where the money came from'));

      const savingsUsed =
        v.source === 'SAVINGS'
          ? v.amount
          : v.source === 'SALARY_AND_SAVINGS'
            ? v.fromSavings
            : null;

      if (v.source === 'SALARY_AND_SAVINGS') {
        if (!isValidAmount(v.fromSalary)) {
          issue('fromSalary', tr('Enter a positive amount with up to 2 decimal places'));
        }
        if (!isValidAmount(v.fromSavings)) {
          issue('fromSavings', tr('Enter a positive amount with up to 2 decimal places'));
        }
        if (
          isValidAmount(v.fromSalary) &&
          isValidAmount(v.fromSavings) &&
          isValidAmount(v.amount) &&
          cents(v.fromSalary) + cents(v.fromSavings) !== cents(v.amount)
        ) {
          issue('fromSavings', tr('The two parts must add up to {v0}', { v0: money(v.amount) }));
        }
      }
      if (savingsUsed && isValidAmount(savingsUsed)) {
        if (savingsAvailable !== null && cents(savingsUsed) > cents(savingsAvailable)) {
          issue(
            v.source === 'SAVINGS' ? 'amount' : 'fromSavings',
            tr('Your savings only have {v0}', { v0: money(savingsAvailable) }),
          );
        }
        if (v.paidOn > today) {
          issue('paidOn', tr('Savings can only pay for a repayment dated today or earlier'));
        }
      }
      if (v.source === 'LOAN' && !v.fundingLender) {
        issue('fundingLender', tr('Enter who you borrowed the money from'));
      }
      if (v.source === 'OTHER' && !v.sourceNote) {
        issue('sourceNote', tr('Explain how you paid'));
      }
    });
}

type Values = z.infer<ReturnType<typeof schemaFor>>;

export function RepayDialog({
  loan,
  repayment,
  onOpenChange,
}: {
  loan: Loan | null;
  /** Set to edit an existing repayment instead of recording a new one. */
  repayment?: LoanRepayment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  return (
    <Dialog open={loan !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {loan &&
              (repayment
                ? tr(LOAN_COPY[loan.direction].editTitle)
                : tr(LOAN_COPY[loan.direction].repayTitle, { name: loan.counterparty }))}
          </DialogTitle>
          <DialogDescription>
            {loan &&
              (repayment
                ? tr('Up to {v0} can be recorded for this entry.', {
                    v0: money(maxFor(loan, repayment)),
                  })
                : tr(LOAN_COPY[loan.direction].repayDescription, {
                    v0: money(loan.outstanding),
                    name: loan.counterparty,
                  }))}
          </DialogDescription>
        </DialogHeader>
        {loan && (
          <RepayForm
            key={`${loan.id}-${repayment?.id ?? 'new'}`}
            loan={loan}
            repayment={repayment ?? undefined}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RepayForm({
  loan,
  repayment,
  onDone,
}: {
  loan: Loan;
  repayment?: LoanRepayment;
  onDone: () => void;
}) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const { money } = useFormatters();
  const repay = useRepayLoan();
  const update = useUpdateRepayment();
  const savings = useSavingsSummary();
  const loans = useLoans();
  const copy = LOAN_COPY[loan.direction];
  const asksSource = loan.direction === 'BORROWED';
  const today = todayIn(user.timezone);
  const max = maxFor(loan, repayment);
  const funding = repayment?.funding ?? null;

  // When editing, savings this repayment already took out come back before it is re-recorded.
  const savingsAvailable = savings.data
    ? fromCents(
        cents(savings.data.balance) + (funding?.fromSavings ? cents(funding.fromSavings) : 0),
      )
    : null;

  const { register, control, handleSubmit, formState, setError, setValue } = useForm<Values>({
    resolver: zodResolver(schemaFor({ loan, max, today, savingsAvailable, tr, money })),
    defaultValues: {
      amount: repayment?.amount ?? '',
      paidOn: repayment?.paidOn ?? today,
      notes: repayment?.notes ?? '',
      source: funding?.source ?? '',
      fromSalary: funding?.source === 'SALARY_AND_SAVINGS' ? (funding.fromSalary ?? '') : '',
      fromSavings: funding?.source === 'SALARY_AND_SAVINGS' ? (funding.fromSavings ?? '') : '',
      fundingLender: funding?.loan?.counterparty ?? '',
      sourceNote: funding?.note ?? '',
    },
  });
  const [source, amount, fromSalary] = useWatch({
    control,
    name: ['source', 'amount', 'fromSalary'],
  });

  // Names you have borrowed from before, offered as suggestions for "Another loan".
  const lenders = [
    ...new Set(
      (loans.data?.loans ?? [])
        .filter((l) => l.direction === 'BORROWED' && l.id !== loan.id)
        .map((l) => l.counterparty),
    ),
  ];

  const submit = handleSubmit(async (v) => {
    const input: RepaymentInput = { amount: v.amount, paidOn: v.paidOn, notes: v.notes || null };
    if (asksSource && v.source) {
      input.source = v.source;
      if (v.source === 'SALARY_AND_SAVINGS') {
        input.fromSalary = v.fromSalary;
        input.fromSavings = v.fromSavings;
      }
      if (v.source === 'LOAN') input.fundingLender = v.fundingLender;
      if (v.source === 'OTHER') input.sourceNote = v.sourceNote;
    }
    try {
      if (repayment) {
        await update.mutateAsync({ id: loan.id, repaymentId: repayment.id, input });
      } else {
        await repay.mutateAsync({ id: loan.id, input });
      }
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        const message = error.message;
        if (/savings only|add up|salary and how much/i.test(message)) {
          setError(source === 'SAVINGS' ? 'amount' : 'fromSavings', { message });
        } else if (/borrowed the money|loan from/i.test(message)) {
          setError('fundingLender', { message });
        } else if (/explain/i.test(message)) setError('sourceNote', { message });
        else if (/came from/i.test(message)) setError('source', { message });
        else if (/date/i.test(message)) setError('paidOn', { message });
        else setError('amount', { message: error.fieldErrors.amount ?? message });
      }
    }
  });

  const option = REPAYMENT_SOURCE_OPTIONS.find((o) => o.value === source);
  const splitRest =
    isValidAmount(amount) && isValidAmount(fromSalary) && cents(fromSalary) < cents(amount)
      ? fromCents(cents(amount) - cents(fromSalary))
      : null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="r-amount">
              {tr('Amount (')}
              {user.currency})
            </Label>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setValue('amount', max, { shouldValidate: true, shouldDirty: true })}
            >
              {tr(copy.repayInFull)}
            </button>
          </div>
          <Input
            id="r-amount"
            inputMode="decimal"
            placeholder="0.00"
            className="tabular"
            autoFocus
            aria-invalid={!!formState.errors.amount}
            {...register('amount')}
          />
          <FieldError message={formState.errors.amount?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-date">{tr(copy.repayDateLabel)}</Label>
          <Input
            id="r-date"
            type="date"
            min={loan.loanDate}
            aria-invalid={!!formState.errors.paidOn}
            {...register('paidOn')}
          />
          <FieldError message={formState.errors.paidOn?.message} />
        </div>
      </div>

      {asksSource && (
        <div className="space-y-2">
          <Label id="r-source-label">{tr('Paid from')}</Label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-labelledby="r-source-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {REPAYMENT_SOURCE_OPTIONS.map((o) => {
                  const selected = field.value === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(o.value)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        selected
                          ? 'border-primary/50 bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <o.icon className="size-4 shrink-0" />
                      <span className="min-w-0">{tr(o.label)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          />
          <FieldError message={formState.errors.source?.message} />
          {option && <p className="text-xs text-muted-foreground">{tr(option.hint)}</p>}

          {source && SOURCES_USING_SAVINGS.includes(source) && savingsAvailable !== null && (
            <p className="text-xs text-muted-foreground">
              {tr('Available in savings: {v0}', { v0: money(savingsAvailable) })}
            </p>
          )}

          {source === 'SALARY_AND_SAVINGS' && (
            <div className="grid gap-4 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-salary">{tr('From salary / income')}</Label>
                <Input
                  id="r-salary"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular"
                  aria-invalid={!!formState.errors.fromSalary}
                  {...register('fromSalary')}
                />
                <FieldError message={formState.errors.fromSalary?.message} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="r-savings">{tr('From savings')}</Label>
                  {splitRest && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        setValue('fromSavings', splitRest, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    >
                      {tr('Use the rest')}
                    </button>
                  )}
                </div>
                <Input
                  id="r-savings"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular"
                  aria-invalid={!!formState.errors.fromSavings}
                  {...register('fromSavings')}
                />
                <FieldError message={formState.errors.fromSavings?.message} />
              </div>
            </div>
          )}

          {source === 'LOAN' && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="r-lender">{tr('Borrowed from')}</Label>
              <Input
                id="r-lender"
                list="r-lender-options"
                placeholder={tr('e.g. Rahim, City Bank')}
                aria-invalid={!!formState.errors.fundingLender}
                {...register('fundingLender')}
              />
              <datalist id="r-lender-options">
                {lenders.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <FieldError message={formState.errors.fundingLender?.message} />
            </div>
          )}

          {source === 'OTHER' && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="r-other">{tr('How did you pay?')}</Label>
              <Textarea
                id="r-other"
                rows={2}
                placeholder={tr('e.g. Sold my old phone')}
                aria-invalid={!!formState.errors.sourceNote}
                {...register('sourceNote')}
              />
              <FieldError message={formState.errors.sourceNote?.message} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="r-notes">
          {tr('Notes')}{' '}
          <span className="font-normal text-muted-foreground">{tr('(optional)')}</span>
        </Label>
        <Input id="r-notes" placeholder={tr(copy.repayNotesPlaceholder)} {...register('notes')} />
        <FieldError message={formState.errors.notes?.message} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {repayment ? tr('Save changes') : tr(copy.repaySubmit)}
        </Button>
      </div>
    </form>
  );
}
