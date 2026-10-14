'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { NAV_ITEMS } from './nav-items';

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t: tr } = useLanguage();
  const pathname = usePathname();
  return (
    <nav aria-label={tr('Main')} className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active
                ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-border'
                : 'text-sidebar-foreground/80 hover:bg-card/60 hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-[18px] transition-colors',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
              )}
              strokeWidth={active ? 2.2 : 1.9}
            />
            {tr(label)}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  const { t: tr } = useLanguage();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
      <Link
        href="/dashboard"
        className="mb-7 px-2 outline-none"
        aria-label={tr('Daily Expense home')}
      >
        <Logo />
      </Link>
      <NavLinks />
      <div className="mt-auto rounded-xl border bg-card/70 p-3.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{tr('Tip')}</p>
        <p className="mt-1 leading-relaxed">
          {tr('Press')}{' '}
          <kbd className="rounded border bg-muted px-1 font-mono text-[11px] text-foreground">
            N
          </kbd>{' '}
          {tr('anywhere to add a transaction.')}{' '}
        </p>
      </div>
    </aside>
  );
}
