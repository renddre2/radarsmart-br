'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { NormalizedOffer, StoreComparisonLink } from '@/types/domain';

export const CLICK_STORAGE_KEY = 'radarsmart_clicks_v1';

export interface StoredClickEvent {
  offerId: string;
  title: string;
  brand: string;
  priceBand: string;
  storeId: string;
  storeLabel: string;
  program: string;
  monetized: boolean;
  price: number;
  clickedAt: string;
}

export function RedirectBridgeClient({ offer }: { offer: NormalizedOffer }) {
  const [target, setTarget] = useState<StoreComparisonLink>(() => ({
    storeId: offer.storeKey,
    storeLabel: offer.storeName,
    program: offer.monetizedProgram,
    url: offer.monetizedUrl,
    monetized: offer.isDirectlyMonetized,
    estimatedCommissionPct: '2%–6%',
    note: 'Oferta principal verificada',
  }));
  const [countdown, setCountdown] = useState<number>(2);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStore = params.get('store');
    const matched = requestedStore
      ? offer.comparisonLinks.find((c) => c.storeId === requestedStore)
      : offer.comparisonLinks[0];

    const chosen: StoreComparisonLink = matched ?? {
      storeId: offer.storeKey,
      storeLabel: offer.storeName,
      program: offer.monetizedProgram,
      url: offer.monetizedUrl,
      monetized: offer.isDirectlyMonetized,
      estimatedCommissionPct: '2%–6%',
      note: 'Oferta principal verificada',
    };
    setTarget(chosen);

    // Record local click telemetry (schema-versioned key)
    try {
      const existingRaw = window.localStorage.getItem(CLICK_STORAGE_KEY);
      const parsed = existingRaw ? (JSON.parse(existingRaw) as StoredClickEvent[]) : [];
      const event: StoredClickEvent = {
        offerId: offer.id,
        title: offer.title,
        brand: offer.brand,
        priceBand: offer.priceBand,
        storeId: chosen.storeId,
        storeLabel: chosen.storeLabel,
        program: chosen.program,
        monetized: chosen.monetized,
        price: offer.effectivePrice,
        clickedAt: new Date().toISOString(),
      };
      const updated = [event, ...(Array.isArray(parsed) ? parsed : [])].slice(0, 250);
      window.localStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors in private browsing
    }

    // Optional Google Analytics 4 event
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'affiliate_outbound_click', {
        offer_id: offer.id,
        store: chosen.storeId,
        program: chosen.program,
        value: offer.effectivePrice,
        currency: 'BRL',
      });
    }

    // Optional free analytics webhook (Apps Script / Cloudflare / Supabase Edge)
    const webhook = process.env.NEXT_PUBLIC_ANALYTICS_WEBHOOK_URL;
    if (webhook && navigator.sendBeacon) {
      navigator.sendBeacon(
        webhook,
        JSON.stringify({
          offerId: offer.id,
          storeId: chosen.storeId,
          program: chosen.program,
          price: offer.effectivePrice,
          ts: new Date().toISOString(),
        }),
      );
    }

    const interval = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(interval);
          window.location.assign(chosen.url);
          return 0;
        }
        return c - 1;
      });
    }, 900);

    return () => window.clearInterval(interval);
  }, [offer]);

  return (
    <div className="mx-auto max-w-xl surface-card p-6 sm:p-8 flex flex-col gap-4 text-center">
      <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]">
        Redirecionamento Seguro RadarSmart BR
      </div>
      <h1 className="text-xl sm:text-2xl font-extrabold m-0">
        Levando você para {target.storeLabel}
      </h1>
      <p className="text-sm text-[var(--text-muted)] m-0">
        Produto: <strong>{offer.title}</strong>
      </p>
      <div className="surface-subtle p-3 text-xs text-[var(--text-muted)]">
        {countdown > 0
          ? `Redirecionando automaticamente em ${countdown}s...`
          : 'Abrindo página oficial da loja...'}
        <div className="mt-1">
          Modo de link: <strong>{target.program}</strong>{' '}
          ({target.monetized ? 'Tag de afiliado ativa' : 'Link direto comparativo'})
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <a href={target.url} rel="noopener noreferrer sponsored" className="btn-primary text-sm">
          Ir agora para {target.storeLabel} →
        </a>
        <Link href={`/oferta/${offer.slug}/`} className="btn-secondary text-sm">
          Voltar à ficha
        </Link>
      </div>
    </div>
  );
}
