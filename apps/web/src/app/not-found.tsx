'use client';

import { useLanguage } from '@/lib/i18n/language-provider';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const { t: tr } = useLanguage();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{tr('Page not found')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {tr('The page you are looking for does not exist or was moved.')}{' '}
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">{tr('Back to dashboard')}</Link>
      </Button>
    </main>
  );
}
