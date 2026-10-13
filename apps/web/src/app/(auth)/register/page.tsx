'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AuthHeading,
  FormAlert,
  PasswordInput,
  useRedirectIfAuthenticated,
} from '@/components/auth/auth-form-parts';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth/auth-provider';
import { passwordSchema } from '@/lib/validation';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(80),
    email: z.email('Enter a valid email address'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

export default function RegisterPage() {
  useRedirectIfAuthenticated();
  const { register: registerAccount } = useAuth();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });
  const { register, handleSubmit, formState, setError: setFieldError } = form;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setError(null);
    try {
      await registerAccount({ name, email, password });
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setFieldError('email', { message: e.message });
      else setError(errorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Start tracking in under a minute. Categories are set up for you."
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={!!formState.errors.name}
            {...register('name')}
          />
          <FieldError message={formState.errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!formState.errors.email}
            {...register('email')}
          />
          <FieldError message={formState.errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!formState.errors.password}
            aria-describedby="password-hint"
            {...register('password')}
          />
          {formState.errors.password ? (
            <FieldError message={formState.errors.password.message} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters with a letter and a number.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={!!formState.errors.confirm}
            {...register('confirm')}
          />
          <FieldError message={formState.errors.confirm?.message} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
