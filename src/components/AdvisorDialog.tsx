'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NormalizedOffer } from '@/types/domain';

type UseCasePriority = 'equilibrado' | 'cameras' | 'jogos' | 'bateria' | 'economico';

interface AdvisorDialogProps {
  offers: NormalizedOffer[];
  buttonLabel?: string;
  buttonClassName?: string;
}

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AdvisorDialog({
  offers,
  buttonLabel = 'Abrir Consultor IA de Compra',
  buttonClassName = 'btn-primary',
}: AdvisorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [maxBudget, setMaxBudget] = useState<number>(2200);
  const [priority, setPriority] = useState<UseCasePriority>('equilibrado');
  const [includeRefurb, setIncludeRefurb] = useState<boolean>(true);
  const [require5g, setRequire5g] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>('');

  // Mandatory fallback for browsers without native `closedby="any"` (Safari / older browsers)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, []);

  const recommendations = useMemo(() => {
    const filtered = offers.filter((o) => {
      if (o.effectivePrice > maxBudget) return false;
      if (!includeRefurb && o.condition === 'recondicionado') return false;
      if (require5g && !o.specs.has5g) return false;
      return true;
    });

    const scored = filtered.map((o) => {
      let fit = o.opportunityScore;
      if (priority === 'economico') {
        fit += Math.max(0, 25 - Math.round(o.effectivePrice / 120));
      } else if (priority === 'cameras') {
        if (/200MP|48MP|OIS|Sony|LYTIA/i.test(o.specs.cameraSummary)) fit += 14;
      } else if (priority === 'jogos') {
        if ((o.specs.ramGb ?? 0) >= 8) fit += 8;
        if (/120Hz|144Hz/i.test(o.specs.screenSummary)) fit += 6;
      } else if (priority === 'bateria') {
        if ((o.specs.batteryMah ?? 0) >= 5000) fit += 10;
      }
      return { offer: o, fit };
    });

    return scored.sort((a, b) => b.fit - a.fit).slice(0, 3);
  }, [offers, maxBudget, priority, includeRefurb, require5g]);

  const faqReply = useMemo(() => {
    const q = question.trim().toLowerCase();
    if (!q) return null;
    if (q.includes('anatel') || q.includes('original') || q.includes('nota') || q.includes('garantia')) {
      return 'Todas as ofertas listadas vêm diretamente de varejistas e fabricantes nacionais (Motorola Oficial, Fast Shop, Bemol, Angeloni, Fujioka e Trocafone), sujeitas à homologação Anatel, emissão de nota fiscal e garantia legal pelo Código de Defesa do Consumidor (CDC).';
    }
    if (q.includes('recondicionad') || q.includes('trocafone') || q.includes('usado')) {
      return 'Aparelhos recondicionados (como os da Trocafone) recebem selo âmbar explícito "Recondicionado Certificado". Eles custam bem menos que aparelhos lacrados e contam com garantia legal de 90 dias, mas sempre confira o grau estético (Excelente/Muito Bom/Bom) antes de fechar.';
    }
    if (q.includes('5g') || q.includes('nfc') || q.includes('aproxim')) {
      return `No catálogo atual com seu orçamento de até ${formatBrl(maxBudget)}, ${recommendations.filter((r) => r.offer.specs.has5g).length} das 3 principais indicações contam com 5G e ${recommendations.filter((r) => r.offer.specs.hasNfc).length} possuem NFC para pagamentos por aproximação.`;
    }
    if (q.includes('bateria') || q.includes('carreg')) {
      return 'Para máxima autonomia, priorize modelos Android com 5.000 mAh ou mais (linhas Moto G, Galaxy A e Motorola Edge). Use o filtro "Bateria longa" acima para reordenar as melhores opções disponíveis agora.';
    }
    if (q.includes('melhor') || q.includes('qual') || q.includes('recomenda') || q.includes('compra')) {
      const top = recommendations[0]?.offer;
      return top
        ? `Com teto de ${formatBrl(maxBudget)}, nossa principal indicação verificada hoje é o ${top.title} por ${formatBrl(top.effectivePrice)} na ${top.storeName} (Score ${top.opportunityScore}/100).`
        : 'Nenhuma oferta dentro deste teto exato — tente aumentar o orçamento no controle acima.';
    }
    return `Analisamos ${offers.length} smartphones em estoque agora. Com teto de ${formatBrl(maxBudget)}, há ${recommendations.length} destaques imediatos exibidos abaixo — clique em "Ver ficha" para comparar também Amazon, Magalu e Mercado Livre.`;
  }, [question, maxBudget, recommendations, offers.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>

      {/* Native <dialog> without redundant role="dialog" or aria-modal per modern-web-guidance */}
      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="advisor-dialog-title"
        className="radar-dialog"
      >
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
          <div>
            <h1 id="advisor-dialog-title" className="text-lg font-bold m-0 text-[var(--text-main)]">
              Consultor Técnico RadarSmart BR
            </h1>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              Recomendações baseadas apenas em smartphones verificados em estoque neste ciclo.
            </p>
          </div>
          <form method="dialog">
            <button type="submit" className="btn-secondary text-xs" autoFocus>
              Fechar (Esc)
            </button>
          </form>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4 max-h-[72dvh]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="surface-subtle p-3 flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">Orçamento máximo: {formatBrl(maxBudget)}</span>
              <input
                type="range"
                min={700}
                max={12000}
                step={100}
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
              />
            </label>

            <label className="surface-subtle p-3 flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">Prioridade de uso</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as UseCasePriority)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-sm text-[var(--text-main)]"
              >
                <option value="equilibrado">Equilibrado (Custo-Benefício)</option>
                <option value="economico">Menor Preço Possível</option>
                <option value="cameras">Câmeras e Redes Sociais</option>
                <option value="jogos">Desempenho, RAM e 120Hz</option>
                <option value="bateria">Bateria de Longa Duração</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={require5g}
                onChange={(e) => setRequire5g(e.target.checked)}
              />
              <span>Exigir 5G</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRefurb}
                onChange={(e) => setIncludeRefurb(e.target.checked)}
              />
              <span>Incluir recondicionados certificados (Trocafone)</span>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="advisor-question" className="text-xs font-semibold text-[var(--text-muted)]">
              Dúvida rápida (ex.: Tem garantia Anatel? Recondicionado vale a pena? Qual melhor câmera?)
            </label>
            <input
              id="advisor-question"
              type="search"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pergunte sobre garantia, 5G, NFC, bateria ou comparação..."
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)]"
            />
            {faqReply ? (
              <div className="surface-subtle p-3 text-xs leading-relaxed text-[var(--text-main)]">
                <strong>Resposta objetiva:</strong> {faqReply}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-bold m-0">Top 3 celulares para o seu perfil agora:</h2>
            {recommendations.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] m-0">
                Nenhuma oferta encontrada com esses filtros. Aumente o orçamento ou desmarque um filtro.
              </p>
            ) : (
              recommendations.map(({ offer }) => (
                <div
                  key={offer.id}
                  className="surface-subtle p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                      {offer.storeName} • {offer.condition === 'recondicionado' ? 'Recondicionado' : 'Novo'} • Score {offer.opportunityScore}/100
                    </div>
                    <div className="font-bold text-sm truncate">{offer.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {offer.specs.screenSummary} • {offer.specs.cameraSummary}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <strong className="text-base" style={{ color: 'var(--color-emerald)' }}>
                      {formatBrl(offer.effectivePrice)}
                    </strong>
                    <Link
                      href={`/oferta/${offer.slug}/`}
                      onClick={() => dialogRef.current?.close()}
                      className="btn-primary text-xs"
                    >
                      Ver oferta
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
