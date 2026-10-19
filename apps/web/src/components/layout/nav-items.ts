import {
  ArrowLeftRight,
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Tags,
  Vault,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/savings', label: 'Savings', icon: Vault },
  { href: '/loans', label: 'Loans', icon: HandCoins },
  { href: '/settings', label: 'Settings', icon: Settings },
];
