'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { useUser } from '@/lib/auth/auth-provider';
import { formatDate } from '@/lib/format';

/** Renders an ISO calendar date with the user's preferred date format. */
export function FormattedDate({ date, className }: { date: string; className?: string }) {
  const { locale } = useLanguage();
  const { dateFormat } = useUser();
  return (
    <time dateTime={date} className={className}>
      {formatDate(date, dateFormat, locale)}
    </time>
  );
}

export function useDateFormatter() {
  const { locale } = useLanguage();
  const { dateFormat } = useUser();
  return (date: string) => formatDate(date, dateFormat, locale);
}
