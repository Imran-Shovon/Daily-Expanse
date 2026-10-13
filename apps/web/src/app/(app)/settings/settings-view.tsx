'use client';

import {
  CURRENCIES,
  DATE_FORMATS,
  DATE_RANGE_PRESET_LABELS,
  DATE_RANGE_PRESETS,
  type DateFormat,
  type DateRangePreset,
  type Theme,
} from '@expense/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordInput } from '@/components/auth/auth-form-parts';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { FieldError } from '@/components/common/field-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { usersApi } from '@/lib/api/endpoints';
import { errorMessage, invalidateFinancialData } from '@/lib/api/hooks';
import { useAuth, useUser } from '@/lib/auth/auth-provider';
import { formatDate, formatMoney } from '@/lib/format';
import { passwordSchema } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

function Section({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-col gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer && <CardFooter className="justify-end gap-2 bg-muted/20">{footer}</CardFooter>}
    </Card>
  );
}

/* Profile ----------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.email('Enter a valid email address'),
  currentPassword: z.string(),
});

function ProfileSection() {
  const user = useUser();
  const { setUser } = useAuth();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email, currentPassword: '' },
  });
  const { register, handleSubmit, formState, reset, setError, control } = form;
  const emailChanged = useWatch({ control, name: 'email' }).trim().toLowerCase() !== user.email;

  const submit = handleSubmit(async (v) => {
    if (emailChanged && !v.currentPassword) {
      setError('currentPassword', { message: 'Enter your current password to change your email' });
      return;
    }
    try {
      const updated = await usersApi.update({
        name: v.name,
        ...(emailChanged ? { email: v.email, currentPassword: v.currentPassword } : {}),
      });
      setUser(updated);
      reset({ name: updated.name, email: updated.email, currentPassword: '' });
      toast.success('Profile updated');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setError('currentPassword', { message: e.message });
      else if (e instanceof ApiError && e.status === 409) setError('email', { message: e.message });
      else toast.error('Could not update profile', { description: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Profile"
        description="Your name and the email you sign in with."
        footer={
          <Button type="submit" disabled={!formState.isDirty || formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save profile
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Display name</Label>
            <Input
              id="s-name"
              autoComplete="name"
              aria-invalid={!!formState.errors.name}
              {...register('name')}
            />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Email</Label>
            <Input
              id="s-email"
              type="email"
              autoComplete="email"
              aria-invalid={!!formState.errors.email}
              {...register('email')}
            />
            <FieldError message={formState.errors.email?.message} />
          </div>
        </div>
        {emailChanged && (
          <div className="space-y-1.5 sm:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor="s-current">Current password</Label>
            <PasswordInput
              id="s-current"
              autoComplete="current-password"
              aria-invalid={!!formState.errors.currentPassword}
              {...register('currentPassword')}
            />
            <FieldError message={formState.errors.currentPassword?.message} />
          </div>
        )}
      </Section>
    </form>
  );
}

/* Preferences ------------------------------------------------------------- */

function timeZones(current: string): string[] {
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(current) ? all : [current, ...all];
  } catch {
    return [current, 'UTC'];
  }
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

interface Prefs {
  currency: string;
  timezone: string;
  dateFormat: DateFormat;
  theme: Theme;
  defaultDateRange: DateRangePreset;
}

function PreferencesSection() {
  const user = useUser();
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const zones = React.useMemo(() => timeZones(user.timezone), [user.timezone]);
  const browserZone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { control, handleSubmit, formState, reset, register, setValue } = useForm<Prefs>({
    defaultValues: {
      currency: user.currency,
      timezone: user.timezone,
      dateFormat: user.dateFormat,
      theme: user.theme,
      defaultDateRange: user.defaultDateRange,
    },
  });
  const [currency, dateFormat, timezone] = useWatch({
    control,
    name: ['currency', 'dateFormat', 'timezone'],
  });

  const submit = handleSubmit(async (prefs) => {
    try {
      const updated = await usersApi.update(prefs);
      setUser(updated);
      reset(prefs);
      // Time zone changes what "today" and "this month" mean, so refresh every report.
      void invalidateFinancialData(queryClient);
      toast.success('Preferences saved');
    } catch (e) {
      toast.error('Could not save preferences', { description: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Preferences"
        description="How amounts and dates are shown, and which dates count as today."
        footer={
          <Button type="submit" disabled={!formState.isDirty || formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save preferences
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-currency">Currency</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c} · {formatMoney('1234.5', c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Display only — amounts are not converted.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-timezone">Time zone</Label>
            <select
              id="p-timezone"
              className="flex h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...register('timezone')}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {browserZone && browserZone !== timezone && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setValue('timezone', browserZone, { shouldDirty: true })}
              >
                Use this device&apos;s time zone ({browserZone})
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-date">Date format</Label>
            <Controller
              control={control}
              name="dateFormat"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-date">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {formatDate('2026-03-25', f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-range">Default dashboard range</Label>
            <Controller
              control={control}
              name="defaultDateRange"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_PRESETS.filter((p) => p !== 'custom').map((p) => (
                      <SelectItem key={p} value={p}>
                        {DATE_RANGE_PRESET_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <Controller
          control={control}
          name="theme"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Theme</legend>
              <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={field.value === value}
                    onClick={() => field.onChange(value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      field.value === value &&
                        'border-primary bg-accent text-accent-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Preview: {formatMoney('1234.5', currency)} on {formatDate('2026-03-25', dateFormat)}
        </p>
      </Section>
    </form>
  );
}

/* Security ---------------------------------------------------------------- */

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

function SecuritySection() {
  const { applySession } = useAuth();
  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const { register, handleSubmit, formState, reset, setError } = form;

  const submit = handleSubmit(async (v) => {
    try {
      const session = await usersApi.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      applySession(session);
      reset();
      toast.success('Password changed', { description: 'Other devices have been signed out.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setError('currentPassword', { message: e.message });
      else if (e instanceof ApiError && e.status === 400)
        setError('newPassword', { message: e.message });
      else toast.error('Could not change password', { description: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Password"
        description="Changing your password signs you out everywhere else."
        footer={
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Change password
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              aria-invalid={!!formState.errors.currentPassword}
              {...register('currentPassword')}
            />
            <FieldError message={formState.errors.currentPassword?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <PasswordInput
              id="pw-new"
              autoComplete="new-password"
              aria-invalid={!!formState.errors.newPassword}
              {...register('newPassword')}
            />
            <FieldError message={formState.errors.newPassword?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <PasswordInput
              id="pw-confirm"
              autoComplete="new-password"
              aria-invalid={!!formState.errors.confirm}
              {...register('confirm')}
            />
            <FieldError message={formState.errors.confirm?.message} />
          </div>
        </div>
      </Section>
    </form>
  );
}

/* Danger zone ------------------------------------------------------------- */

function DangerZone() {
  const { logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassword('');
      setConfirmation('');
      setError(null);
    }
    setOpen(next);
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="flex-col gap-1">
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and every transaction, budget, category and schedule. This
          cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Delete your account?"
        description="All of your data will be erased immediately. Consider exporting your transactions first."
        confirmLabel="Delete account"
        onConfirm={async () => {
          if (confirmation !== 'DELETE' || !password) {
            setError('Enter your password and type DELETE to confirm.');
            throw new Error('not confirmed');
          }
          try {
            await usersApi.deleteAccount({ password, confirmation });
          } catch (e) {
            setError(errorMessage(e));
            throw e;
          }
          toast.success('Your account has been deleted');
          await logout().catch(() => undefined);
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="del-password">Password</Label>
            <PasswordInput
              id="del-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="del-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, preferences and security." />
      <ProfileSection />
      <PreferencesSection />
      <SecuritySection />
      <DangerZone />
    </div>
  );
}
