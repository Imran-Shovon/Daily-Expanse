import type { Metadata } from 'next';
import { LoansView } from './loans-view';

export const metadata: Metadata = { title: 'Loans' };

export default function LoansPage() {
  return <LoansView />;
}
