'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthHeading, FormAlert, PasswordInput } from '@/components/auth/auth-form-parts';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/hooks';
import { passwordSchema } from '@/lib/validation';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });
  const { register, handleSubmit, formState } = form;

  if (!token) {
    return (
      <>
        <AuthHeading
          title="Invalid reset link"
          description="This link is missing its token. Request a new one to continue."
        />
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      router.replace('/login?reset=1');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <>
      <AuthHeading
        title="Choose a new password"
        description="For your security, this signs you out on every device."
      />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert message={error} />
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!formState.errors.password}
            {...register('password')}
          />
          <FieldError message={formState.errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
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
          Update password
        </Button>
        {error && (
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Request a new link
            </Link>
          </p>
        )}
      </form>
    </>
  );
}
