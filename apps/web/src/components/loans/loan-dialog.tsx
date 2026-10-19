'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Loan } from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
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

const schema = z
  .object({
    lender: z
      .string()
      .trim()
      .min(1, 'Enter who you borrowed from')
      .max(80, 'Keep the name under 80 characters'),
    amount: z
      .string()
      .trim()
      .refine(isValidAmount, 'Enter a positive amount with up to 2 decimal places'),
    borrowedOn: z.string().min(1, 'Choose a date'),
    dueDate: z.string(),
    notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.borrowedOn, {
    path: ['dueDate'],
    message: 'The due date must be on or after the borrowed date',
  });

type Values = z.infer<typeof schema>;

export function LoanDialog({
  open,
  onOpenChange,
  loan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan?: Loan;
}) {
  const { t: tr } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loan ? tr('Edit loan') : tr('Add borrowed money')}</DialogTitle>
          <DialogDescription>
            {tr(
              "Loans are tracked separately: borrowing isn't income and repaying isn't an expense.",
            )}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <LoanForm key={loan?.id ?? 'new'} loan={loan} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoanForm({ loan, onDone }: { loan?: Loan; onDone: () => void }) {
  const { t: tr } = useLanguage();
  const user = useUser();
  const save = useSaveLoan();
  const { register, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      lender: loan?.lender ?? '',
      amount: loan?.amount ?? '',
      borrowedOn: loan?.borrowedOn ?? todayIn(user.timezone),
      dueDate: loan?.dueDate ?? '',
      notes: loan?.notes ?? '',
    },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: loan?.id,
        input: {
          lender: v.lender,
          amount: v.amount,
          borrowedOn: v.borrowedOn,
          dueDate: v.dueDate || null,
          notes: v.notes || null,
        },
      });
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.lender) setError('lender', { message: fields.lender });
        if (fields.amount) setError('amount', { message: fields.amount });
        if (/amount/i.test(error.message)) setError('amount', { message: error.message });
        else if (/borrowed date/i.test(error.message)) {
          setError('borrowedOn', { message: error.message });
        } else if (/due date/i.test(error.message)) {
          setError('dueDate', { message: error.message });
        }
      }
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="l-lender">{tr('Borrowed from')}</Label>
        <Input
          id="l-lender"
          placeholder={tr('e.g. Rahim, City Bank')}
          aria-invalid={!!formState.errors.lender}
          autoFocus
          {...register('lender')}
        />
        <FieldError message={formState.errors.lender?.message} />
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
          <Label htmlFor="l-borrowed">{tr('Borrowed on')}</Label>
          <Input
            id="l-borrowed"
            type="date"
            aria-invalid={!!formState.errors.borrowedOn}
            {...register('borrowedOn')}
          />
          <FieldError message={formState.errors.borrowedOn?.message} />
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
  );
}
