import type { LoanDirection, LoanStatus } from '@expense/shared';

/**
 * Wording for each side of a loan. Borrowed money is repaid by you; lent money is collected
 * from someone else. Every string is an English translation key.
 */
export const LOAN_COPY: Record<
  LoanDirection,
  {
    tab: string;
    newTitle: string;
    counterpartyLabel: string;
    counterpartyPlaceholder: string;
    counterpartyRequired: string;
    dateLabel: string;
    /** "{v0}" is the formatted loan date. */
    cardDate: string;
    dialogDescription: string;
    status: Record<LoanStatus, string>;
    outstanding: string;
    settledInFull: string;
    action: string;
    /** "{v0}" is the amount repaid or collected. */
    progress: string;
    progressLabel: string;
    oneEntry: string;
    manyEntries: string;
    removeEntry: string;
    editEntry: string;
    editTitle: string;
    summaryOutstanding: string;
    summaryTotal: string;
    summaryRepaid: string;
    sectionOpen: string;
    sectionSettled: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyAction: string;
    deleteDescription: string;
    undoTitle: string;
    undoDescription: string;
    repayTitle: string;
    repayDescription: string;
    repayDateLabel: string;
    repayInFull: string;
    repayTooMuch: string;
    repayNotesPlaceholder: string;
    repaySubmit: string;
  }
> = {
  BORROWED: {
    tab: 'Borrowed',
    newTitle: 'Add borrowed money',
    counterpartyLabel: 'Borrowed from',
    counterpartyPlaceholder: 'e.g. Rahim, City Bank',
    counterpartyRequired: 'Enter who you borrowed from',
    dateLabel: 'Borrowed on',
    cardDate: 'Borrowed {v0}',
    dialogDescription:
      "Loans are tracked separately: borrowing isn't income and repaying isn't an expense.",
    status: { active: 'Owed', overdue: 'Overdue', paid: 'Paid off' },
    outstanding: 'Still owed',
    settledInFull: 'Repaid in full',
    action: 'Repay',
    progress: '{v0} repaid',
    progressLabel: 'Repaid',
    oneEntry: '1 repayment',
    manyEntries: '{count} repayments',
    removeEntry: 'Remove repayment of {v0}',
    editEntry: 'Edit repayment of {v0}',
    editTitle: 'Edit repayment',
    summaryOutstanding: 'You still owe',
    summaryTotal: 'Total borrowed',
    summaryRepaid: 'Total repaid',
    sectionOpen: 'Still owed',
    sectionSettled: 'Paid off',
    emptyTitle: 'No borrowed money',
    emptyDescription:
      'When you borrow money, add it here. Record each repayment and see what you still owe.',
    emptyAction: 'Add borrowed money',
    deleteDescription:
      'The loan from “{name}” and all its repayments will be removed permanently, along with the expenses and savings withdrawals those repayments recorded.',
    undoTitle: 'Remove this repayment?',
    undoDescription:
      '{v0} will be added back to what you owe {name}. Any expense, savings withdrawal or new loan it recorded is removed too.',
    repayTitle: 'Repay {name}',
    repayDescription: 'You still owe {v0}.',
    repayDateLabel: 'Paid on',
    repayInFull: 'Pay in full',
    repayTooMuch: 'That is more than you still owe',
    repayNotesPlaceholder: 'e.g. Paid by bKash',
    repaySubmit: 'Record repayment',
  },
  LENT: {
    tab: 'Lent',
    newTitle: 'Add money you lent',
    counterpartyLabel: 'Lent to',
    counterpartyPlaceholder: 'e.g. Karim, a colleague',
    counterpartyRequired: 'Enter who you lent to',
    dateLabel: 'Lent on',
    cardDate: 'Lent {v0}',
    dialogDescription:
      "Tracked separately too: lending isn't an expense and collecting it back isn't income.",
    status: { active: 'To collect', overdue: 'Overdue', paid: 'Settled' },
    outstanding: 'Owed to you',
    settledInFull: 'Collected in full',
    action: 'Collect',
    progress: '{v0} collected',
    progressLabel: 'Collected',
    oneEntry: '1 collection',
    manyEntries: '{count} collections',
    removeEntry: 'Remove collection of {v0}',
    editEntry: 'Edit collection of {v0}',
    editTitle: 'Edit collection',
    summaryOutstanding: 'Owed to you',
    summaryTotal: 'Total lent',
    summaryRepaid: 'Total collected',
    sectionOpen: 'Still to collect',
    sectionSettled: 'Settled',
    emptyTitle: 'No money lent',
    emptyDescription:
      'When you lend money to someone, add it here. Record each amount they pay back and see what they still owe you.',
    emptyAction: 'Add money you lent',
    deleteDescription:
      'The money lent to “{name}” and all its collections will be removed permanently.',
    undoTitle: 'Remove this collection?',
    undoDescription: '{v0} will be added back to what {name} owes you.',
    repayTitle: 'Collect from {name}',
    repayDescription: '{name} still owes you {v0}.',
    repayDateLabel: 'Received on',
    repayInFull: 'Collect in full',
    repayTooMuch: 'That is more than they still owe',
    repayNotesPlaceholder: 'e.g. Received by bKash',
    repaySubmit: 'Record collection',
  },
};
