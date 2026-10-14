'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { QuickAddProvider } from '@/components/transactions/transaction-dialog';
import { useAuth } from '@/lib/auth/auth-provider';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { Logo } from './logo';

function FullPageLoader() {
  const { t: tr } = useLanguage();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo showText={false} />
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={tr('Loading')} />
    </div>
  );
}

/** Client-side gate for authenticated pages. The API enforces access regardless. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') return <FullPageLoader />;

  return (
    <QuickAddProvider>
      <div className="flex min-h-dvh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main
            id="main"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
          >
            <React.Suspense fallback={null}>{children}</React.Suspense>
          </main>
        </div>
      </div>
    </QuickAddProvider>
  );
}
