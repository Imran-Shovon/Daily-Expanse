import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from '@/components/layout/logo';

function PreviewCard() {
  const bars = [38, 62, 45, 80, 52, 70, 58, 90, 64, 76, 48, 84];
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur">
      <p className="text-sm text-emerald-100/70">Saved this month</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-white">$1,284.60</p>
      <p className="mt-1 text-xs text-emerald-200/80">32% savings rate · on track with 4 budgets</p>
      <div className="mt-6 flex h-28 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[4px] bg-emerald-300/70"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-5 space-y-2.5" aria-hidden>
        {[
          ['Groceries', '78%'],
          ['Transport', '41%'],
        ].map(([label, pct]) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-white/70">
              <span>{label}</span>
              <span>{pct}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: pct }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,46%)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/login" className="w-fit" aria-label="Daily Expense">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Daily Expense. Your data stays yours.
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[oklch(0.3_0.06_160)] lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 70% 20%, oklch(0.55 0.12 160 / 0.55), transparent), radial-gradient(50% 40% at 20% 90%, oklch(0.45 0.1 180 / 0.5), transparent)',
          }}
        />
        <div className="relative w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-white">
            Know where every taka, dollar and euro goes.
          </h2>
          <p className="mt-2 mb-8 text-sm text-emerald-50/70">
            Daily tracking, honest budgets and reports that stay out of your way.
          </p>
          <PreviewCard />
        </div>
      </aside>
    </div>
  );
}
