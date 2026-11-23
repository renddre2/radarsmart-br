import Link from 'next/link';
import {
  getActiveOffers,
  getGuides,
  getMarketPulse,
  getOpsReport,
} from '@/lib/dataLoader';
import { OfferCard } from '@/components/OfferCard';
import { AdvisorDialog } from '@/components/AdvisorDialog';
import { OfferCatalogClient } from '@/components/OfferCatalogClient';

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function HomePage() {
  const offers = getActiveOffers();
  const guides = getGuides();
  const pulse = getMarketPulse();
  const ops = getOpsReport();
  const featured = offers[0] ?? null;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero + #1 Featured Opportunity */}
      <section className="grid gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 surface-card p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {offers.length} celulares verificados em {ops?.sources.filter((s) => s.status === 'ok').length ?? 6} fontes oficiais
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight m-0">
              Celulares com preço real verificado — zero estoque próprio, zero desconto falso.
            </h1>
            <p className="text-base text-[var(--text-muted)] m-0 leading-relaxed">
              Varremos catálogos oficiais brasileiros a cada 6 horas, filtramos acessórios, auditamos preços de tabela
              contra o histórico e comparamos as melhores lojas nacionais em um só painel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AdvisorDialog
              offers={offers}
              buttonLabel="Consultor IA: Qual celular comprar?"
              buttonClassName="btn-primary text-sm"
            />
            <Link href="/comparar/" className="btn-secondary text-sm">
              Comparar 3 Modelos Lado a Lado
            </Link>
            <Link href="/guias/" className="btn-secondary text-sm">
              Ver Guias por Orçamento
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-color)] text-center sm:text-left">
            <div>
              <div className="text-xl font-extrabold">{offers.length}</div>
              <div className="text-xs text-[var(--text-muted)]">Em estoque agora</div>
            </div>
            <div>
              <div className="text-xl font-extrabold">
                {offers[0] ? formatBrl(Math.min(...offers.map((o) => o.effectivePrice))) : '—'}
              </div>
              <div className="text-xs text-[var(--text-muted)]">A partir de</div>
            </div>
            <div>
              <div className="text-xl font-extrabold">100%</div>
              <div className="text-xs text-[var(--text-muted)]">Checkout em loja oficial</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col">
          {featured ? (
            <div className="h-full flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)] mb-2">
                Destaque #1 em Oportunidade Hoje
              </div>
              <OfferCard offer={featured} isLcpCandidate deferImage={false} />
            </div>
          ) : (
            <div className="surface-card p-6">Nenhuma oferta carregada neste snapshot.</div>
          )}
        </div>
      </section>

      {/* Interactive Catalog + Responsive Table */}
      <OfferCatalogClient offers={offers} />

      {/* SEO Guides below the fold */}
      <section className="below-fold-deferred flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold m-0">Guias de Compra Atualizados Automaticamente</h2>
            <p className="text-sm text-[var(--text-muted)] m-0">
              Páginas focadas em intenção real de compra no Brasil, recalculadas a cada varredura.
            </p>
          </div>
          <Link href="/guias/" className="text-sm font-semibold text-[var(--color-brand)] underline">
            Todos os guias →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guias/${guide.slug}/`}
              className="surface-card p-5 no-underline text-[var(--text-main)] flex flex-col justify-between gap-3 hover:border-[var(--color-brand)]"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand)]">
                  Guia SEO Verificado
                </span>
                <h3 className="text-base font-bold mt-1 mb-2 leading-snug">{guide.title}</h3>
                <p className="text-xs text-[var(--text-muted)] m-0 line-clamp-3">{guide.summary}</p>
              </div>
              <span className="text-xs font-semibold text-[var(--color-brand)]">Ler guia completo →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Editorial Market Pulse below the fold */}
      {pulse.length > 0 ? (
        <section className="below-fold-deferred surface-card p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold m-0">Pulso do Mercado Mobile (RSS Oficial)</h2>
              <p className="text-xs text-[var(--text-muted)] m-0">
                Manchetes recentes de lançamentos e tecnologia para contextualizar o melhor momento de compra.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pulse.slice(0, 6).map((item, idx) => (
              <a
                key={`${item.link}-${idx}`}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-subtle p-3.5 no-underline text-[var(--text-main)] hover:border-[var(--color-brand)] flex flex-col gap-1"
              >
                <div className="text-[11px] font-semibold text-[var(--color-brand)]">{item.source}</div>
                <div className="text-sm font-bold leading-snug">{item.title}</div>
                {item.snippet ? (
                  <p className="text-xs text-[var(--text-muted)] m-0 line-clamp-2">{item.snippet}</p>
                ) : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
