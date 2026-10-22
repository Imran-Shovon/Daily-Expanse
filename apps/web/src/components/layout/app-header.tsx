'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { LogOut, Menu, Monitor, Moon, Plus, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { toast } from 'sonner';
import { useQuickAdd } from '@/components/transactions/transaction-dialog';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/common/language-toggle';
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usersApi } from '@/lib/api/endpoints';
import { useAuth, useUser } from '@/lib/auth/auth-provider';
import { initials } from '@/lib/format';
import { NavLinks } from './app-sidebar';
import { Logo } from './logo';
import { NAV_ITEMS } from './nav-items';

function ThemeToggle() {
  const { t: tr } = useLanguage();
  const { resolvedTheme } = useTheme();
  const { setUser } = useAuth();
  const user = useUser();

  const choose = async (theme: 'light' | 'dark' | 'system') => {
    const previous = user;
    setUser({ ...user, theme });
    try {
      setUser(await usersApi.update({ theme }));
    } catch {
      setUser(previous);
      toast.error(tr('Could not save theme preference'));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tr('Change theme')}>
          {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => choose('light')}>
          <Sun /> {tr('Light')}{' '}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => choose('dark')}>
          <Moon /> {tr('Dark')}{' '}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => choose('system')}>
          <Monitor /> {tr('System')}{' '}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { t: tr } = useLanguage();
  const user = useUser();
  const { logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-offset-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={tr('Account menu')}
        >
          {initials(user.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> {tr('Settings')}{' '}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> {tr('Sign out')}{' '}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const { t: tr } = useLanguage();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const current = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="lg:hidden" aria-label={tr('Daily Expense home')}>
          <Logo showText={false} />
        </Link>
        <p className="hidden text-sm text-muted-foreground lg:block">{tr(current?.label ?? '')}</p>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={() => quickAdd()} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{tr('Add transaction')}</span>
            <span className="sm:hidden">{tr('Add')}</span>
          </Button>
          <ThemeToggle />
          <LanguageToggle />
          <UserMenu />
          {/* Phones and tablets: navigation opens from the right, next to the thumb. */}
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 lg:hidden"
              aria-label={tr('Open navigation')}
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
            <SheetContent side="right" aria-describedby={undefined}>
              <DialogTitle className="sr-only">{tr('Navigation')}</DialogTitle>
              <div className="px-5 pt-5 pb-6">
                <Logo />
              </div>
              <div className="px-3">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
