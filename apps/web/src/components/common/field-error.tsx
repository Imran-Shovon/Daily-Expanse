'use client';

import { useLanguage } from '@/lib/i18n/language-provider';
export function FieldError({ message }: { message?: string }) {
  const { t: tr } = useLanguage();
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {tr(message)}
    </p>
  );
}
