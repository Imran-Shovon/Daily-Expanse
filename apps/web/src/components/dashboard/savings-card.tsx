'use client';
import { useLanguage } from '@/lib/i18n/language-provider';

import { ArrowDownToLine } from 'lucide-react';
import Link from 'next/link';
import { useFormatters } from '@/components/common/money';
import { LoadingSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSavingsSummary } from '@/lib/api/hooks';

export function SavingsCard() {
  const { t: tr } = useLanguage();
  const { money } = useFormatters();
  const savings = useSavingsSummary();
  const s = savings.data;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">{tr('Savings')}</p>
          <p className="text-sm text-muted-foreground">{tr('Money you have kept aside')}</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mt-1 -mr-2">
          <Link href="/savings">{tr('Manage')}</Link>
        </Button>
      </div>
      <div className="mt-4">
        {savings.isLoading ? (
          <LoadingSkeleton variant="list" rows={1} />
        ) : !s || s.entryCount === 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/savings">
              <ArrowDownToLine /> {tr('Start saving')}
            </Link>
          </Button>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight tabular">{money(s.balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular">
              {tr('This month')}:{' '}
              <span className="text-emerald-700 dark:text-emerald-400">
                +{money(s.thisMonth.added)}
              </span>{' '}
              · −{money(s.thisMonth.takenOut)}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
