'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { NormalizedOffer } from '@/types/domain';

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ComparatorClient({ offers }: { offers: NormalizedOffer[] }) {
  const initialIds = useMemo(() => offers.slice(0, 3).map((o) => o.id), [offers]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => offers.find((o) => o.id === id))
        .filter((o): o is NormalizedOffer => Boolean(o)),
    [offers, selectedIds],
  );

  const updateSlot = (idx: number, newId: string) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[idx] = newId;
      return next;
    });
  };

  const bestPriceId = useMemo(() => {
    if (selected.length === 0) return '';
    return [...selected].sort((a, b) => a.effectivePrice - b.effectivePrice)[0].id;
  }, [selected]);

  const bestScoreId = useMemo(() => {
    if (selected.length === 0) return '';
    return [...selected].sort((a, b) => b.opportunityScore - a.opportunityScore)[0].id;
  }, [selected]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((slotIdx) => (
          <label key={slotIdx} className="surface-card p-3.5 flex flex-col gap-1.5 text-xs font-semibold">
            <span>Aparelho #{slotIdx + 1}</span>
            <select
              value={selectedIds[slotIdx] ?? ''}
              onChange={(e) => updateSlot(slotIdx, e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] px-2.5 py-2 text-sm text-[var(--text-main)]"
            >
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.specs.canonicalModel} {o.specs.storageGb ? `${o.specs.storageGb}GB` : ''} — {formatBrl(o.effectivePrice)} ({o.storeName})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div tabIndex={0} role="region" aria-labelledby="comparator-caption" className="table-wrapper">
        <table className="radar-table">
          <caption id="comparator-caption" className="sr-only">
            Comparação técnica lado a lado entre smartphones selecionados
          </caption>
          <thead>
            <tr>
              <th>Critério</th>
              {selected.map((o) => (
                <th key={`h-${o.id}`}>{o.specs.canonicalModel}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Loja &amp; Condição</th>
              {selected.map((o) => (
                <td key={`st-${o.id}`}>
                  {o.storeName} ({o.condition})
                </td>
              ))}
            </tr>
            <tr>
              <th>Preço Verificado</th>
              {selected.map((o) => (
                <td key={`pr-${o.id}`}>
                  <strong style={{ color: 'var(--color-emerald)' }}>{formatBrl(o.effectivePrice)}</strong>
                  {o.id === bestPriceId ? (
                    <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                      Mais barato
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <th>Score RadarSmart</th>
              {selected.map((o) => (
                <td key={`sc-${o.id}`}>
                  <strong>{o.opportunityScore}/100</strong>
                  {o.id === bestScoreId ? (
                    <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded bg-[#0369a1] text-white">
                      Melhor nota
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
            <tr>
              <th>Armazenamento / RAM</th>
              {selected.map((o) => (
                <td key={`mem-${o.id}`}>
                  {o.specs.storageGb ? `${o.specs.storageGb} GB` : 'Padrão'} /{' '}
                  {o.specs.ramGb ? `${o.specs.ramGb} GB RAM` : 'Consultar'}
                </td>
              ))}
            </tr>
            <tr>
              <th>Tela</th>
              {selected.map((o) => (
                <td key={`scr-${o.id}`}>{o.specs.screenSummary}</td>
              ))}
            </tr>
            <tr>
              <th>Câmeras</th>
              {selected.map((o) => (
                <td key={`cam-${o.id}`}>{o.specs.cameraSummary}</td>
              ))}
            </tr>
            <tr>
              <th>5G &amp; NFC</th>
              {selected.map((o) => (
                <td key={`net-${o.id}`}>
                  {o.specs.has5g ? '5G Sim' : '4G'} • {o.specs.hasNfc ? 'NFC Sim' : 'Sem NFC confirmado'}
                </td>
              ))}
            </tr>
            <tr>
              <th>Ação</th>
              {selected.map((o) => (
                <td key={`act-${o.id}`}>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/oferta/${o.slug}/`} className="btn-secondary text-xs">
                      Ficha
                    </Link>
                    <Link href={`/ir/${o.id}/`} className="btn-primary text-xs">
                      Ir à loja
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
