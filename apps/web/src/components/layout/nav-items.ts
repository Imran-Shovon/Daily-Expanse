import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Tags,
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
  { href: '/settings', label: 'Settings', icon: Settings },
];
