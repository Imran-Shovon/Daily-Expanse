'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { authApi, googleSignInUrl } from '@/lib/api/endpoints';

/** Google's four-colour "G", as their brand guidelines require for sign-in buttons. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google", shown only when the server has Google sign-in configured. It is a
 * full-page navigation: the API sends the browser to Google and back.
 */
export function GoogleSignIn({ next }: { next: string }) {
  const { t: tr } = useLanguage();
  const [leaving, setLeaving] = React.useState(false);
  const providers = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => authApi.providers(),
    staleTime: Infinity,
    retry: false,
  });

  if (!providers.data?.google) return null;

  const start = () => {
    setLeaving(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    window.location.assign(googleSignInUrl(next, timezone));
  };

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={start}
        disabled={leaving}
      >
        {leaving ? <Loader2 className="animate-spin" /> : <GoogleLogo />}
        {tr('Continue with Google')}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {tr('or use your email')}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** Message for a failed Google sign-in, from the `reason` the API puts on /login. */
export function googleErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'cancelled':
      return 'Google sign-in was cancelled.';
    case 'account_linked_elsewhere':
      return 'This email is already connected to a different Google account.';
    case 'unverified_email':
      return 'Your Google account email is not verified, so it cannot be used to sign in.';
    default:
      return 'Could not sign in with Google. Please try again.';
  }
}
