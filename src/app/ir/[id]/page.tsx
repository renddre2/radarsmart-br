import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllKnownOffers, getOfferById } from '@/lib/dataLoader';
import { RedirectBridgeClient } from '@/components/RedirectBridgeClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllKnownOffers().map((o) => ({ id: o.id }));
}

export const metadata: Metadata = {
  title: 'Redirecionando para a Loja Oficial',
  robots: { index: false, follow: false },
};

export default async function RedirectOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offer = getOfferById(id);
  if (!offer) notFound();

  return <RedirectBridgeClient offer={offer} />;
}
