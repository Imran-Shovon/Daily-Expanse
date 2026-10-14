'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-provider';

/** Only allow same-site relative redirects to avoid open-redirect issues. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return '/dashboard';
  return next;
}

/** Sends already signed-in visitors on to the app. */
export function useRedirectIfAuthenticated() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  React.useEffect(() => {
    if (status === 'authenticated') router.replace(safeNext(searchParams.get('next')));
  }, [status, router, searchParams]);
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const { t: tr } = useLanguage();
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
        aria-label={visible ? tr('Hide password') : tr('Show password')}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function FormAlert({
  message,
  tone = 'error',
}: {
  message: string | null;
  tone?: 'error' | 'info' | 'success';
}) {
  const { t: tr } = useLanguage();
  if (!message) return null;
  const styles = {
    error: 'border-destructive/30 bg-destructive/8 text-destructive',
    info: 'border-border bg-muted text-foreground',
    success: 'border-primary/30 bg-accent text-accent-foreground',
  }[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2.5 text-sm ${styles}`}
    >
      {tr(message)}
    </div>
  );
}
