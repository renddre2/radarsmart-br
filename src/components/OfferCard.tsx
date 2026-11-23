import Link from 'next/link';
import type { NormalizedOffer } from '@/types/domain';

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface OfferCardProps {
  offer: NormalizedOffer;
  isLcpCandidate?: boolean;
  deferImage?: boolean;
}

export function OfferCard({ offer, isLcpCandidate = false, deferImage = true }: OfferCardProps) {
  const isRefurb = offer.condition === 'recondicionado';
  const showListPrice = offer.listPrice > offer.effectivePrice && !offer.priceStats.suspiciousListPrice;

  return (
    <article className="surface-card flex flex-col justify-between overflow-hidden transition-transform hover:-translate-y-0.5">
      <div>
        <div className="relative bg-white p-4 flex items-center justify-center h-48 border-b border-[var(--border-color)]">
          {offer.imageUrl ? (
            <img
              src={offer.imageUrl}
              alt={`${offer.specs.canonicalModel} na ${offer.storeName}`}
              width={240}
              height={240}
              className="max-h-40 w-auto object-contain"
              {...(isLcpCandidate
                ? { fetchPriority: 'high' as const }
                : deferImage
                  ? { loading: 'lazy' as const }
                  : {})}
            />
          ) : (
            <div className="text-xs text-slate-500">Imagem indisponível</div>
          )}

          <span
            className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: offer.opportunityScore >= 80 ? '#047857' : '#0369a1' }}
          >
            Score {offer.opportunityScore}/100
          </span>

          {offer.priceStats.verifiedDiscountPct >= 5 ? (
            <span className="absolute top-3 right-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
              -{offer.priceStats.verifiedDiscountPct}% real
            </span>
          ) : null}
        </div>

        <div className="p-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <span className="rounded-md px-2 py-0.5 bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-color)]">
              {offer.storeName}
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-white"
              style={{ backgroundColor: isRefurb ? '#b45309' : '#0f766e' }}
            >
              {isRefurb ? 'Recondicionado Certificado' : 'Novo Nacional'}
            </span>
            {offer.isBundle ? (
              <span className="rounded-md px-2 py-0.5 bg-indigo-600 text-white">Kit c/ Fone</span>
            ) : null}
          </div>

          <h3 className="text-sm font-bold leading-snug text-[var(--text-main)] line-clamp-2 min-h-[2.5rem] m-0">
            <Link href={`/oferta/${offer.slug}/`} className="text-inherit no-underline hover:underline">
              {offer.title}
            </Link>
          </h3>

          <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
            {offer.specs.storageGb ? (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">{offer.specs.storageGb} GB</span>
            ) : null}
            {offer.specs.ramGb ? (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">{offer.specs.ramGb} GB RAM</span>
            ) : null}
            {offer.specs.has5g ? (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">5G</span>
            ) : null}
            {offer.specs.hasNfc ? (
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">NFC</span>
            ) : null}
          </div>

          <div className="pt-1">
            {showListPrice ? (
              <div className="text-xs text-[var(--text-muted)] line-through">{formatBrl(offer.listPrice)}</div>
            ) : null}
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-emerald)' }}>
              {formatBrl(offer.effectivePrice)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{offer.priceStats.priceAlertLabel}</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
        <Link href={`/oferta/${offer.slug}/`} className="btn-secondary text-xs">
          Ficha &amp; Lojas
        </Link>
        <Link href={`/ir/${offer.id}/`} className="btn-primary text-xs">
          Ir à Oferta →
        </Link>
      </div>
    </article>
  );
}
