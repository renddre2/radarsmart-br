'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { NormalizedOffer } from '@/types/domain';
import { OfferCard } from './OfferCard';

type SortOption = 'score' | 'price-asc' | 'price-desc' | 'discount';

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface OfferCatalogClientProps {
  offers: NormalizedOffer[];
}

export function OfferCatalogClient({ offers }: OfferCatalogClientProps) {
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('Todas');
  const [maxPrice, setMaxPrice] = useState<number>(0); // 0 = sem teto
  const [conditionFilter, setConditionFilter] = useState<'todos' | 'novo' | 'recondicionado'>('todos');
  const [only5g, setOnly5g] = useState(false);
  const [onlyNfc, setOnlyNfc] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [showAllCards, setShowAllCards] = useState(false);

  const brands = useMemo(() => {
    const set = new Set(offers.map((o) => o.brand));
    return ['Todas', ...Array.from(set).sort()];
  }, [offers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = offers.filter((o) => {
      if (brand !== 'Todas' && o.brand !== brand) return false;
      if (maxPrice > 0 && o.effectivePrice > maxPrice) return false;
      if (conditionFilter !== 'todos' && o.condition !== conditionFilter) return false;
      if (only5g && !o.specs.has5g) return false;
      if (onlyNfc && !o.specs.hasNfc) return false;
      if (q) {
        const hay = `${o.title} ${o.brand} ${o.storeName} ${o.specs.canonicalModel} ${o.specs.chipset}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.effectivePrice - b.effectivePrice;
      if (sortBy === 'price-desc') return b.effectivePrice - a.effectivePrice;
      if (sortBy === 'discount') {
        return b.priceStats.verifiedDiscountPct - a.priceStats.verifiedDiscountPct || b.opportunityScore - a.opportunityScore;
      }
      return b.opportunityScore - a.opportunityScore || a.effectivePrice - b.effectivePrice;
    });
  }, [offers, search, brand, maxPrice, conditionFilter, only5g, onlyNfc, sortBy]);

  const visibleCards = showAllCards ? filtered : filtered.slice(0, 12);
  const topForTable = filtered.slice(0, 18);

  return (
    <div className="flex flex-col gap-8">
      {/* Filter Toolbar */}
      <section aria-label="Filtros de ofertas" className="surface-card p-4 flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="catalog-search" className="sr-only">
              Buscar celular, modelo ou loja
            </label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo, memória ou loja (ex.: Galaxy A56, Moto G, 256GB, iPhone)..."
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3.5 py-2 text-sm text-[var(--text-main)]"
            />
          </div>

          <div>
            <label htmlFor="brand-filter" className="sr-only">Marca</label>
            <select
              id="brand-filter"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  Marca: {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sort-filter" className="sr-only">Ordenar por</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-main)]"
            >
              <option value="score">Ordenar: Maior Score RadarSmart</option>
              <option value="discount">Ordenar: Maior Desconto Real</option>
              <option value="price-asc">Ordenar: Menor Preço</option>
              <option value="price-desc">Ordenar: Maior Preço</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Todos os preços', val: 0 },
              { label: 'Até R$ 1.200', val: 1200 },
              { label: 'Até R$ 1.600', val: 1600 },
              { label: 'Até R$ 2.500', val: 2500 },
              { label: 'Até R$ 4.000', val: 4000 },
            ].map((chip) => (
              <button
                key={chip.val}
                type="button"
                onClick={() => setMaxPrice(chip.val)}
                className={`px-3 py-1.5 rounded-full border cursor-pointer font-medium ${
                  maxPrice === chip.val
                    ? 'bg-[var(--color-brand)] text-[var(--color-brand-text)] border-transparent'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border-color)]'
                }`}
              >
                {chip.label}
              </button>
            ))}

            <select
              aria-label="Condição do aparelho"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value as 'todos' | 'novo' | 'recondicionado')}
              className="px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-main)]"
            >
              <option value="todos">Novos + Recondicionados</option>
              <option value="novo">Somente Novos</option>
              <option value="recondicionado">Somente Recondicionados</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 cursor-pointer">
              <input type="checkbox" checked={only5g} onChange={(e) => setOnly5g(e.target.checked)} />
              <span>5G</span>
            </label>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 cursor-pointer">
              <input type="checkbox" checked={onlyNfc} onChange={(e) => setOnlyNfc(e.target.checked)} />
              <span>NFC</span>
            </label>
          </div>

          <div className="text-[var(--text-muted)] font-medium">
            Exibindo <strong>{filtered.length}</strong> smartphones verificados
          </div>
        </div>
      </section>

      {/* Cards Grid */}
      {visibleCards.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-base font-semibold m-0">Nenhum smartphone encontrado com esses filtros.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setBrand('Todas');
              setMaxPrice(0);
              setConditionFilter('todos');
              setOnly5g(false);
              setOnlyNfc(false);
            }}
            className="btn-secondary mt-3 text-sm"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCards.map((offer, idx) => (
            <OfferCard key={offer.id} offer={offer} deferImage={idx >= 4} />
          ))}
        </div>
      )}

      {filtered.length > 12 ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowAllCards((v) => !v)}
            className="btn-secondary text-sm"
          >
            {showAllCards
              ? 'Mostrar menos ofertas'
              : `Carregar todas as ${filtered.length} ofertas filtradas`}
          </button>
        </div>
      ) : null}

      {/* Responsive Comparison Table below the fold */}
      <section className="below-fold-deferred flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comparison-table-caption" className="text-xl font-bold m-0">
            Tabela Comparativa Rápida (Top {topForTable.length} do Filtro)
          </h2>
          <Link href="/comparar/" className="text-sm font-semibold text-[var(--color-brand)] underline">
            Abrir comparador lado a lado →
          </Link>
        </div>

        <div tabIndex={0} role="region" aria-labelledby="comparison-table-caption" className="table-wrapper">
          <table className="radar-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Loja &amp; Condição</th>
                <th>Preço Verificado</th>
                <th>Specs</th>
                <th>Score</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {topForTable.map((o) => (
                <tr key={`tbl-${o.id}`}>
                  <th>
                    <Link href={`/oferta/${o.slug}/`} className="text-inherit no-underline hover:underline">
                      {o.specs.canonicalModel}
                      {o.specs.storageGb ? ` (${o.specs.storageGb} GB)` : ''}
                    </Link>
                  </th>
                  <td>
                    <span>{o.storeName}</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {o.condition === 'recondicionado' ? 'Recondicionado' : 'Novo Nacional'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--color-emerald)' }}>{formatBrl(o.effectivePrice)}</strong>
                    {o.priceStats.verifiedDiscountPct >= 5 ? (
                      <span className="block text-xs text-[var(--text-muted)]">
                        -{o.priceStats.verifiedDiscountPct}% real
                      </span>
                    ) : null}
                  </td>
                  <td className="text-xs text-[var(--text-muted)]">
                    {o.specs.screenSummary} • {o.specs.has5g ? '5G' : '4G'} {o.specs.hasNfc ? '• NFC' : ''}
                  </td>
                  <td>
                    <strong>{o.opportunityScore}/100</strong>
                  </td>
                  <td>
                    <Link href={`/ir/${o.id}/`} className="btn-primary text-xs whitespace-nowrap">
                      Ver loja
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
