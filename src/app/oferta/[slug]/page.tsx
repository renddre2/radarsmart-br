import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getActiveOffers,
  getAllKnownOffers,
  getOfferById,
  getOfferBySlug,
  getPriceHistory,
  getSiteUrl,
} from '@/lib/dataLoader';

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllKnownOffers().map((offer) => ({ slug: offer.slug }));
}

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const offer = getOfferBySlug(slug);
  if (!offer) {
    return { title: 'Oferta não encontrada' };
  }
  const priceStr = formatBrl(offer.effectivePrice);
  const title = `${offer.specs.canonicalModel}${offer.specs.storageGb ? ` ${offer.specs.storageGb}GB` : ''} por ${priceStr} (${offer.storeName})`;
  const description = `${offer.analysis.verdict} Confira ficha técnica, histórico de preço e comparação entre Amazon, Magalu, Mercado Livre e lojas oficiais.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: offer.imageUrl ? [{ url: offer.imageUrl }] : undefined,
    },
  };
}

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offer = getOfferBySlug(slug);
  if (!offer) notFound();

  const historyMap = getPriceHistory();
  const modelHistory = historyMap.records[offer.canonicalKey];
  const activeOffers = getActiveOffers();
  const replacement = offer.replacementOfferId
    ? getOfferById(offer.replacementOfferId)
    : activeOffers.find((o) => o.canonicalKey === offer.canonicalKey && o.id !== offer.id);

  const related = activeOffers
    .filter((o) => o.id !== offer.id && (o.brand === offer.brand || o.priceBand === offer.priceBand))
    .slice(0, 4);

  const siteUrl = getSiteUrl();
  const canonicalPageUrl = `${siteUrl}/oferta/${offer.slug}/`;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: offer.title,
    image: offer.imageUrl ? [offer.imageUrl] : undefined,
    brand: { '@type': 'Brand', name: offer.brand },
    description: offer.analysis.verdict,
    offers: {
      '@type': 'Offer',
      url: canonicalPageUrl,
      priceCurrency: 'BRL',
      price: offer.effectivePrice.toFixed(2),
      availability:
        offer.status === 'active'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition:
        offer.condition === 'recondicionado'
          ? 'https://schema.org/RefurbishedCondition'
          : 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: offer.storeName },
    },
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: offer.analysis.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <div className="flex flex-col gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)] flex flex-wrap gap-1.5">
        <Link href="/" className="text-[var(--color-brand)] no-underline hover:underline">
          Início
        </Link>
        <span>/</span>
        <span>{offer.brand}</span>
        <span>/</span>
        <span className="text-[var(--text-main)] font-medium">{offer.specs.canonicalModel}</span>
      </nav>

      {offer.status === 'expired' ? (
        <div
          role="status"
          className="surface-card p-5 border-2"
          style={{ borderColor: 'var(--color-amber)' }}
        >
          <strong className="block text-base mb-1" style={{ color: 'var(--color-amber)' }}>
            Esta oferta saiu de estoque ou foi encerrada na {offer.storeName}.
          </strong>
          <p className="text-sm text-[var(--text-muted)] m-0 mb-3">
            Mantemos esta ficha para preservar o histórico de preço. Confira abaixo a alternativa ativa mais próxima:
          </p>
          {replacement ? (
            <Link href={`/oferta/${replacement.slug}/`} className="btn-primary text-sm">
              Ver alternativa em estoque: {replacement.title} ({formatBrl(replacement.effectivePrice)}) →
            </Link>
          ) : (
            <Link href="/" className="btn-primary text-sm">
              Ver todas as ofertas ativas →
            </Link>
          )}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 surface-card bg-white p-6 flex items-center justify-center min-h-[320px]">
          {offer.imageUrl ? (
            <img
              src={offer.imageUrl}
              alt={offer.title}
              width={360}
              height={360}
              fetchPriority="high"
              className="max-h-80 w-auto object-contain"
            />
          ) : (
            <span className="text-sm text-slate-500">Sem imagem disponível</span>
          )}
        </div>

        <div className="lg:col-span-7 surface-card p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-[#047857] text-white">
                Score {offer.opportunityScore}/100
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                {offer.storeName}
              </span>
              <span
                className="px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: offer.condition === 'recondicionado' ? '#b45309' : '#0f766e' }}
              >
                {offer.condition === 'recondicionado' ? 'Recondicionado Certificado (90d CDC)' : 'Produto Novo Nacional'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold m-0 leading-tight">{offer.title}</h1>

            <div className="surface-subtle p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                {offer.listPrice > offer.effectivePrice && !offer.priceStats.suspiciousListPrice ? (
                  <div className="text-xs text-[var(--text-muted)] line-through">
                    De {formatBrl(offer.listPrice)}
                  </div>
                ) : null}
                <div className="text-3xl font-extrabold" style={{ color: 'var(--color-emerald)' }}>
                  {formatBrl(offer.effectivePrice)}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{offer.priceStats.priceAlertLabel}</div>
              </div>

              <div className="flex flex-col gap-2">
                <Link href={`/ir/${offer.id}/`} className="btn-primary text-sm">
                  Ir para {offer.storeName} →
                </Link>
                <span className="text-[11px] text-[var(--text-muted)] text-center">
                  Checado em {new Date(offer.observedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed m-0">{offer.analysis.verdict}</p>
            <div className="text-xs text-[var(--text-muted)]">
              <strong>Indicado para:</strong> {offer.analysis.idealFor}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="surface-subtle p-2.5">
              <span className="text-[var(--text-muted)] block">Armazenamento</span>
              <strong>{offer.specs.storageGb ? `${offer.specs.storageGb} GB` : 'Padrão'}</strong>
            </div>
            <div className="surface-subtle p-2.5">
              <span className="text-[var(--text-muted)] block">Memória RAM</span>
              <strong>{offer.specs.ramGb ? `${offer.specs.ramGb} GB` : 'Consultar loja'}</strong>
            </div>
            <div className="surface-subtle p-2.5">
              <span className="text-[var(--text-muted)] block">Conectividade</span>
              <strong>
                {offer.specs.has5g ? '5G' : '4G'} {offer.specs.hasNfc ? '+ NFC' : ''}
              </strong>
            </div>
            <div className="surface-subtle p-2.5">
              <span className="text-[var(--text-muted)] block">Bateria</span>
              <strong>{offer.specs.batteryMah ?? 5000} mAh</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Store Comparison Matrix */}
      <section className="surface-card p-6 flex flex-col gap-3">
        <h2 className="text-xl font-bold m-0">Onde Comprar / Comparar Preço Hoje</h2>
        <p className="text-xs text-[var(--text-muted)] m-0">
          Antes de finalizar na {offer.storeName}, vale conferir o valor no carrinho de outros grandes varejistas nacionais.
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {offer.comparisonLinks.map((link) => (
            <div key={link.storeId} className="surface-subtle p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{link.storeLabel}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{link.note}</div>
              </div>
              <Link
                href={`/ir/${offer.id}/?store=${encodeURIComponent(link.storeId)}`}
                className={link.storeId === offer.storeKey ? 'btn-primary text-xs shrink-0' : 'btn-secondary text-xs shrink-0'}
              >
                Abrir
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Specs, Pros/Watchout & Price History */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6 flex flex-col gap-3">
          <h2 className="text-lg font-bold m-0">Análise Honesta &amp; Ficha Técnica</h2>
          <ul className="m-0 pl-5 flex flex-col gap-1.5 text-sm">
            {offer.analysis.pros.map((pro, idx) => (
              <li key={idx}>{pro}</li>
            ))}
          </ul>
          <div className="surface-subtle p-3 text-xs leading-relaxed">
            <strong>Ponto de atenção:</strong> {offer.analysis.watchout}
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs pt-2 border-t border-[var(--border-color)] m-0">
            <dt className="text-[var(--text-muted)]">Tela</dt>
            <dd className="m-0 font-semibold">{offer.specs.screenSummary}</dd>
            <dt className="text-[var(--text-muted)]">Câmeras</dt>
            <dd className="m-0 font-semibold">{offer.specs.cameraSummary}</dd>
            <dt className="text-[var(--text-muted)]">Processador</dt>
            <dd className="m-0 font-semibold">{offer.specs.chipset}</dd>
            <dt className="text-[var(--text-muted)]">Sistema</dt>
            <dd className="m-0 font-semibold">{offer.specs.os}</dd>
          </dl>
        </div>

        <div className="surface-card p-6 flex flex-col gap-3">
          <h2 className="text-lg font-bold m-0">Histórico Anti-Fraude &amp; Score</h2>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="surface-subtle p-3">
              <span className="text-[var(--text-muted)] block">Menor observado</span>
              <strong className="text-sm">{formatBrl(offer.priceStats.minObservedPrice)}</strong>
            </div>
            <div className="surface-subtle p-3">
              <span className="text-[var(--text-muted)] block">Média histórica</span>
              <strong className="text-sm">{formatBrl(offer.priceStats.avgObservedPrice)}</strong>
            </div>
            <div className="surface-subtle p-3">
              <span className="text-[var(--text-muted)] block">Leituras</span>
              <strong className="text-sm">{modelHistory?.observationsCount ?? offer.priceStats.observationsCount}</strong>
            </div>
          </div>

          <div className="text-xs flex flex-col gap-1.5 pt-2">
            <div className="font-semibold">Composição do Score ({offer.opportunityScore}/100):</div>
            <div>• Hardware / Custo-benefício: {offer.scoreBreakdown.technical}/35</div>
            <div>• Desconto real verificado: {offer.scoreBreakdown.discount}/30</div>
            <div>• Confiança da loja nacional: {offer.scoreBreakdown.trust}/20</div>
            <div>• Demanda / Conectividade: {offer.scoreBreakdown.commercial}/15</div>
          </div>
          <p className="text-xs text-[var(--text-muted)] m-0 pt-2 border-t border-[var(--border-color)]">
            {offer.specs.anatelNote}
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="below-fold-deferred surface-card p-6 flex flex-col gap-3">
        <h2 className="text-xl font-bold m-0">Perguntas Frequentes sobre esta Oferta</h2>
        <div className="flex flex-col gap-3">
          {offer.analysis.faqs.map((faq, i) => (
            <details key={i} className="surface-subtle p-3.5" open={i === 0}>
              <summary className="font-semibold text-sm cursor-pointer">{faq.question}</summary>
              <p className="text-sm text-[var(--text-muted)] mt-2 mb-0">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="below-fold-deferred flex flex-col gap-3">
          <h2 className="text-xl font-bold m-0">Alternativas Similares em Estoque</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/oferta/${item.slug}/`}
                className="surface-card p-4 no-underline text-[var(--text-main)] hover:border-[var(--color-brand)]"
              >
                <div className="text-xs text-[var(--text-muted)]">{item.storeName}</div>
                <div className="font-bold text-sm mt-1 line-clamp-2">{item.title}</div>
                <div className="font-extrabold text-base mt-2" style={{ color: 'var(--color-emerald)' }}>
                  {formatBrl(item.effectivePrice)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
