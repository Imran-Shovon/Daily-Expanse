'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Loan } from '@expense/shared';
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
import { useRepayLoan } from '@/lib/api/hooks';
import { useUser } from '@/lib/auth/auth-provider';
import { isValidAmount, todayIn } from '@/lib/format';

/** Compares 2-decimal money strings exactly by converting to integer cents. */
const cents = (amount: string) => Math.round(Number(amount) * 100);

function schemaFor(loan: Loan) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places')
      .refine(
        (v) => !isValidAmount(v) || cents(v) <= cents(loan.outstanding),
        'That is more than you still owe',
      ),
    paidOn: z
      .string()
      .min(1, 'Choose a date')
      .refine((v) => v >= loan.borrowedOn, 'A repayment cannot be dated before the loan was taken'),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
  });
}

type Values = z.infer<ReturnType<typeof schemaFor>>;

export function RepayDialog({
  loan,
  onOpenChange,
}: {
  loan: Loan | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  return (
    <Dialog open={loan !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tr('Repay {name}', { name: loan?.lender ?? '' })}</DialogTitle>
          <DialogDescription>
            {loan && tr('You still owe {v0}.', { v0: money(loan.outstanding) })}
          </DialogDescription>
        </DialogHeader>
        {loan && <RepayForm key={loan.id} loan={loan} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RepayForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const repay = useRepayLoan();
  const { register, handleSubmit, formState, setError, setValue } = useForm<Values>({
    resolver: zodResolver(schemaFor(loan)),
    defaultValues: { amount: '', paidOn: todayIn(user.timezone), notes: '' },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await repay.mutateAsync({
        id: loan.id,
        input: { amount: v.amount, paidOn: v.paidOn, notes: v.notes || null },
      });
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
              onClick={() =>
                setValue('amount', loan.outstanding, { shouldValidate: true, shouldDirty: true })
              }
            >
              {tr('Pay in full')}
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
          <Label htmlFor="r-date">{tr('Paid on')}</Label>
          <Input
            id="r-date"
            type="date"
            min={loan.borrowedOn}
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
        <Input id="r-notes" placeholder={tr('e.g. Paid by bKash')} {...register('notes')} />
        <FieldError message={formState.errors.notes?.message} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          {tr('Cancel')}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {tr('Record repayment')}
        </Button>
      </div>
    </form>
  );
}
