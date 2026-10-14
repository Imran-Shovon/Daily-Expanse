'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AuthHeading,
  FormAlert,
  PasswordInput,
  safeNext,
  useRedirectIfAuthenticated,
} from '@/components/auth/auth-form-parts';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth/auth-provider';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export default function LoginPage() {
  const { t: tr } = useLanguage();
  useRedirectIfAuthenticated();
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, formState } = form;

  const notice = searchParams.get('expired')
    ? tr('Your session expired. Please sign in again.')
    : searchParams.get('reset')
      ? tr('Password updated. Sign in with your new password.')
      : null;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await login(email, password);
      router.replace(safeNext(searchParams.get('next')));
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading
        title={tr('Welcome back')}
        description={tr('Sign in to see where your money is going.')}
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        {!error && (
          <FormAlert message={notice} tone={searchParams.get('reset') ? 'success' : 'info'} />
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">{tr('Email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={!!formState.errors.email}
            {...register('email')}
          />
          <FieldError message={formState.errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{tr('Password')}</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              {tr('Forgot password?')}{' '}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!formState.errors.password}
            {...register('password')}
          />
          <FieldError message={formState.errors.password?.message} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {tr('Sign in')}{' '}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {tr('New here?')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {tr('Create an account')}{' '}
        </Link>
      </p>
    </>
  );
}
