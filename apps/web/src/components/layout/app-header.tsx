'use client';

import { LogOut, Menu, Monitor, Moon, Plus, Settings, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { toast } from 'sonner';
import { useQuickAdd } from '@/components/transactions/transaction-dialog';
import { Button } from '@/components/ui/button';
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
      toast.error('Could not save theme preference');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => choose('light')}>
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => choose('dark')}>
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => choose('system')}>
          <Monitor /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const user = useUser();
  const { logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-offset-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Account menu"
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
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const current = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </Button>
          <SheetContent aria-describedby={undefined}>
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <div className="px-5 pt-5 pb-6">
              <Logo />
            </div>
            <div className="px-3">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
          </SheetContent>
        </Dialog>

        <Link href="/dashboard" className="lg:hidden" aria-label="Daily Expense home">
          <Logo showText={false} />
        </Link>
        <p className="hidden text-sm text-muted-foreground lg:block">{current?.label}</p>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={() => quickAdd()} className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add transaction</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
