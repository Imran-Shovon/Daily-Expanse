import type { Metadata } from 'next';
import { TransactionDetails } from './transaction-details';

export const metadata: Metadata = { title: 'Transaction details' };

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetails id={id} />;
}
