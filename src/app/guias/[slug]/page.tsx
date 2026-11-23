import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveOffers, getGuideBySlug, getGuides, getSiteUrl } from '@/lib/dataLoader';
import { OfferCard } from '@/components/OfferCard';

export const dynamicParams = false;

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: 'Guia não encontrado' };
  return {
    title: guide.title,
    description: guide.seoDescription,
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const activeOffers = getActiveOffers();
  const offerMap = new Map(activeOffers.map((o) => [o.id, o]));
  const recommendedOffers = guide.recommendedOfferIds
    .map((id) => offerMap.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  const siteUrl = getSiteUrl();
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.seoDescription,
    dateModified: guide.updatedAt,
    mainEntityOfPage: `${siteUrl}/guias/${guide.slug}/`,
    publisher: { '@type': 'Organization', name: 'RadarSmart BR' },
  };

  return (
    <article className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)] flex gap-1.5">
        <Link href="/" className="text-[var(--color-brand)] no-underline hover:underline">
          Início
        </Link>
        <span>/</span>
        <Link href="/guias/" className="text-[var(--color-brand)] no-underline hover:underline">
          Guias
        </Link>
        <span>/</span>
        <span className="text-[var(--text-main)] font-medium">{guide.title}</span>
      </nav>

      <header className="surface-card p-6 sm:p-8 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">
          Guia Verificado • Busca alvo: {guide.targetQuery}
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold m-0 leading-tight">{guide.title}</h1>
        <p className="text-base text-[var(--text-muted)] m-0 leading-relaxed">{guide.summary}</p>
        <div className="surface-subtle p-3 text-xs text-[var(--text-muted)]">
          <strong>Metodologia:</strong> {guide.methodologyNote} (Atualizado em{' '}
          {new Date(guide.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}).
        </div>
      </header>

      {recommendedOffers.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold m-0">Smartphones Recomendados em Estoque Hoje</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedOffers.map((offer, idx) => (
              <OfferCard key={offer.id} offer={offer} isLcpCandidate={idx === 0} deferImage={idx > 1} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        {guide.sections.map((sec, idx) => (
          <div key={idx} className="surface-card p-6 flex flex-col gap-2">
            <h2 className="text-lg font-bold m-0">{sec.heading}</h2>
            <p className="text-sm text-[var(--text-muted)] m-0 leading-relaxed">{sec.body}</p>
            {sec.bulletPoints.length > 0 ? (
              <ul className="m-0 pl-5 mt-2 flex flex-col gap-1.5 text-sm">
                {sec.bulletPoints.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      {guide.faqs.length > 0 ? (
        <section className="surface-card p-6 flex flex-col gap-3">
          <h2 className="text-lg font-bold m-0">Perguntas Frequentes</h2>
          {guide.faqs.map((faq, idx) => (
            <details key={idx} className="surface-subtle p-3.5" open={idx === 0}>
              <summary className="font-semibold text-sm cursor-pointer">{faq.question}</summary>
              <p className="text-sm text-[var(--text-muted)] mt-2 mb-0">{faq.answer}</p>
            </details>
          ))}
        </section>
      ) : null}
    </article>
  );
}
