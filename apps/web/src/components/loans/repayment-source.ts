import type { RepaymentFunding, RepaymentSource } from '@expense/shared';
import { Briefcase, CircleEllipsis, HandCoins, Layers, Vault, type LucideIcon } from 'lucide-react';

/** The choices for "Paid from", in display order. Labels are English translation keys. */
export const REPAYMENT_SOURCE_OPTIONS: {
  value: RepaymentSource;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: 'SALARY',
    label: 'Salary / income',
    hint: "Added to this month's expenses",
    icon: Briefcase,
  },
  { value: 'SAVINGS', label: 'Savings', hint: 'Taken out of your savings', icon: Vault },
  {
    value: 'SALARY_AND_SAVINGS',
    label: 'Salary + savings',
    hint: 'Split between both',
    icon: Layers,
  },
  {
    value: 'LOAN',
    label: 'Another loan',
    hint: 'Added to your borrowed loans',
    icon: HandCoins,
  },
  { value: 'OTHER', label: 'Other', hint: 'Explain how you paid', icon: CircleEllipsis },
];

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** One line describing where a repayment's money came from, e.g. "From savings". */
export function fundingSummary(
  funding: RepaymentFunding,
  tr: Translate,
  money: (amount: string) => string,
): string {
  switch (funding.source) {
    case 'SALARY':
      return tr('From salary / income');
    case 'SAVINGS':
      return tr('From savings');
    case 'SALARY_AND_SAVINGS':
      return funding.fromSalary && funding.fromSavings
        ? tr('Salary {v0} + savings {v1}', {
            v0: money(funding.fromSalary),
            v1: money(funding.fromSavings),
          })
        : tr('From salary and savings');
    case 'LOAN':
      return funding.loan
        ? tr('Borrowed from {name}', { name: funding.loan.counterparty })
        : tr('From another loan');
    case 'OTHER':
      return funding.note ? `${tr('Other')}: ${funding.note}` : tr('Other');
  }
}
