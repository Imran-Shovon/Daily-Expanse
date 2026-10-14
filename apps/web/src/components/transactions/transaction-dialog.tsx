'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import type { Transaction, TransactionType } from '@expense/shared';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateTransaction, useUpdateTransaction } from '@/lib/api/hooks';
import { TransactionForm } from './transaction-form';

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
  defaultType?: TransactionType;
}) {
  const { t: tr } = useLanguage();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{transaction ? tr('Edit transaction') : tr('New transaction')}</DialogTitle>
          <DialogDescription>
            {transaction
              ? tr('Update the details below.')
              : tr('Record income or an expense in a few seconds.')}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <TransactionForm
            key={transaction?.id ?? 'new'}
            transaction={transaction}
            defaultType={defaultType}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (input) => {
              if (transaction) await update.mutateAsync({ id: transaction.id, input });
              else await create.mutateAsync(input);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* Quick add: one dialog instance for the whole app, opened from the header or empty states. */

const QuickAddContext = React.createContext<(type?: TransactionType) => void>(() => {});

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ open: boolean; type: TransactionType }>({
    open: false,
    type: 'EXPENSE',
  });
  const openQuickAdd = React.useCallback(
    (type: TransactionType = 'EXPENSE') => setState({ open: true, type }),
    [],
  );

  React.useEffect(() => {
    // Keyboard shortcut: "n" opens quick add when not typing in a field.
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      e.preventDefault();
      openQuickAdd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd]);

  return (
    <QuickAddContext.Provider value={openQuickAdd}>
      {children}
      <TransactionDialog
        open={state.open}
        defaultType={state.type}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd() {
  return React.useContext(QuickAddContext);
}
