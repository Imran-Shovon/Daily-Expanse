import type { CategorySummary } from '@expense/shared';
import {
  Baby,
  BookOpen,
  Briefcase,
  Building2,
  Car,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  Dog,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Music,
  Phone,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  car: Car,
  home: House,
  zap: Zap,
  'shopping-bag': ShoppingBag,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  clapperboard: Clapperboard,
  plane: Plane,
  sparkles: Sparkles,
  repeat: Repeat,
  'circle-ellipsis': CircleEllipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  'building-2': Building2,
  'trending-up': TrendingUp,
  gift: Gift,
  wallet: Wallet,
  coffee: Coffee,
  utensils: Utensils,
  baby: Baby,
  dog: Dog,
  dumbbell: Dumbbell,
  phone: Phone,
  wifi: Wifi,
  fuel: Fuel,
  'book-open': BookOpen,
  music: Music,
  shirt: Shirt,
  'piggy-bank': PiggyBank,
};

export function CategoryIcon({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const Icon = CATEGORY_ICON_MAP[icon] ?? CircleEllipsis;
  const box = { sm: 'size-7 rounded-md', md: 'size-9 rounded-lg', lg: 'size-11 rounded-xl' }[size];
  const glyph = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' }[size];
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', box, className)}
      style={{ backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`, color }}
      aria-hidden
    >
      <Icon className={glyph} />
    </span>
  );
}

/** Compact category label: colored dot + name. Identity never relies on color alone. */
export function CategoryBadge({
  category,
  className,
}: {
  category: CategorySummary;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      <span className="truncate">{category.name}</span>
    </span>
  );
}
