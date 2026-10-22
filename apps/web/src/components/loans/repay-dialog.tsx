'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Loan, LoanRepayment } from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useRepayLoan, useUpdateRepayment } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';
import { LOAN_COPY } from './loan-copy';

/** Compares 2-decimal money strings exactly by converting to integer cents. */
const cents = (amount: string) => Math.round(Number(amount) * 100);

/** Most this entry may be: what is outstanding, plus the entry's own amount when editing. */
function maxFor(loan: Loan, repayment?: LoanRepayment | null): string {
  return ((cents(loan.outstanding) + (repayment ? cents(repayment.amount) : 0)) / 100).toFixed(2);
}

function schemaFor(loan: Loan, max: string) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places')
      .refine(
        (v) => !isValidAmount(v) || cents(v) <= cents(max),
        LOAN_COPY[loan.direction].repayTooMuch,
      ),
    paidOn: z
      .string()
      .min(1, 'Choose a date')
      .refine((v) => v >= loan.loanDate, 'A repayment cannot be dated before the loan date'),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
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
      <DialogContent>
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
  const repay = useRepayLoan();
  const update = useUpdateRepayment();
  const copy = LOAN_COPY[loan.direction];
  const max = maxFor(loan, repayment);
  const { register, handleSubmit, formState, setError, setValue } = useForm<Values>({
    resolver: zodResolver(schemaFor(loan, max)),
    defaultValues: {
      amount: repayment?.amount ?? '',
      paidOn: repayment?.paidOn ?? todayIn(user.timezone),
      notes: repayment?.notes ?? '',
    },
  });

  const submit = handleSubmit(async (v) => {
    try {
      const input = { amount: v.amount, paidOn: v.paidOn, notes: v.notes || null };
      if (repayment) {
        await update.mutateAsync({ id: loan.id, repaymentId: repayment.id, input });
      } else {
        await repay.mutateAsync({ id: loan.id, input });
      }
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        if (/date/i.test(error.message)) setError('paidOn', { message: error.message });
        else setError('amount', { message: error.fieldErrors.amount ?? error.message });
      }
    }
  });

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
