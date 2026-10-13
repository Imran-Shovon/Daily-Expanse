'use client';

import { useUser } from '@/lib/auth/auth-provider';
import { formatDate } from '@/lib/format';

/** Renders an ISO calendar date with the user's preferred date format. */
export function FormattedDate({ date, className }: { date: string; className?: string }) {
  const { dateFormat } = useUser();
  return (
    <time dateTime={date} className={className}>
      {formatDate(date, dateFormat)}
    </time>
  );
}

export function useDateFormatter() {
  const { dateFormat } = useUser();
  return (date: string) => formatDate(date, dateFormat);
}
