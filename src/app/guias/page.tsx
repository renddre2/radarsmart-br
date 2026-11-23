import type { Metadata } from 'next';
import Link from 'next/link';
import { getGuides } from '@/lib/dataLoader';

export const metadata: Metadata = {
  title: 'Guias de Compra de Celulares (Atualizados)',
  description:
    'Guias SEO com rankings recalculados automaticamente a partir de estoques e preços verificados no varejo brasileiro.',
};

export default function GuidesIndexPage() {
  const guides = getGuides();

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card p-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold m-0">Guias de Compra de Smartphones</h1>
        <p className="text-sm text-[var(--text-muted)] m-0 mt-1.5">
          Conteúdo atualizado automaticamente a cada varredura oficial — zero recomendações inventadas ou fora de estoque.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guias/${guide.slug}/`}
            className="surface-card p-6 no-underline text-[var(--text-main)] flex flex-col justify-between gap-4 hover:border-[var(--color-brand)]"
          >
            <div>
              <span className="text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wide">
                Atualizado em {new Date(guide.updatedAt).toLocaleDateString('pt-BR')}
              </span>
              <h2 className="text-xl font-bold mt-1 mb-2 leading-snug">{guide.title}</h2>
              <p className="text-sm text-[var(--text-muted)] m-0 leading-relaxed">{guide.summary}</p>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[var(--text-muted)]">
                {guide.recommendedOfferIds.length} modelos recomendados
              </span>
              <span className="text-[var(--color-brand)]">Abrir guia completo →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
