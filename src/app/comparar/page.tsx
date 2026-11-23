import type { Metadata } from 'next';
import { getActiveOffers } from '@/lib/dataLoader';
import { ComparatorClient } from '@/components/ComparatorClient';

export const metadata: Metadata = {
  title: 'Comparador Lado a Lado de Celulares',
  description:
    'Compare até 3 smartphones reais em estoque no Brasil por preço verificado, tela, câmeras, 5G, NFC e custo-benefício.',
};

export default function ComparatorPage() {
  const offers = getActiveOffers();

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card p-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold m-0">Comparador Técnico Lado a Lado</h1>
        <p className="text-sm text-[var(--text-muted)] m-0 mt-1.5">
          Selecione até 3 ofertas ativas verificadas para identificar automaticamente o menor preço e a melhor pontuação técnica.
        </p>
      </div>
      <ComparatorClient offers={offers} />
    </div>
  );
}
