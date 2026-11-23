'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type {
  OpsReport,
  PublishedLedgerEntry,
  SocialPostAsset,
  StrategyWeights,
} from '@/types/domain';
import { CLICK_STORAGE_KEY, type StoredClickEvent } from './RedirectBridgeClient';
import { withBasePath } from '@/lib/sitePaths';

interface DashboardClientProps {
  ops: OpsReport | null;
  queue: SocialPostAsset[];
  ledger: PublishedLedgerEntry[];
  weights: StrategyWeights | null;
  siteUrl: string;
}

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function DashboardClient({ ops, queue, ledger, weights, siteUrl }: DashboardClientProps) {
  const [clicks, setClicks] = useState<StoredClickEvent[]>([]);
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [avgConvPct, setAvgConvPct] = useState<number>(2.5);
  const [avgCommPct, setAvgCommPct] = useState<number>(3.5);
  const [manualClicksPerMonth, setManualClicksPerMonth] = useState<number>(1200);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLICK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredClickEvent[];
        if (Array.isArray(parsed)) setClicks(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      window.setTimeout(() => setCopiedKey(''), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const avgTicket = useMemo(() => {
    if (queue.length === 0) return 1850;
    return queue.reduce((a, b) => a + b.price, 0) / queue.length;
  }, [queue]);

  const projectedSales = Math.round((manualClicksPerMonth * avgConvPct) / 100);
  const projectedRevenue = (projectedSales * avgTicket * avgCommPct) / 100;

  const feedbackJsonString = useMemo(() => {
    const grouped = new Map<string, { offerId: string; brand: string; priceBand: string; storeKey: string; clicks: number }>();
    for (const c of clicks) {
      const k = `${c.offerId}::${c.storeId}`;
      const existing = grouped.get(k);
      if (existing) {
        existing.clicks += 1;
      } else {
        grouped.set(k, {
          offerId: c.offerId,
          brand: c.brand,
          priceBand: c.priceBand,
          storeKey: c.storeId,
          clicks: 1,
        });
      }
    }
    return JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        entries: Array.from(grouped.values()).map((g) => ({
          ...g,
          conversions: 0,
          commissionBrl: 0,
          recordedAt: new Date().toISOString(),
        })),
      },
      null,
      2,
    );
  }, [clicks]);

  const configuredCount = ops?.affiliatePrograms.filter((p) => p.configured).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Executive KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card p-5">
          <div className="text-xs text-[var(--text-muted)] font-semibold">Ofertas Ativas Verificadas</div>
          <div className="text-3xl font-extrabold mt-1">{ops?.activeOffersCount ?? 0}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {ops?.expiredOffersCount ?? 0} expiradas preservadas para SEO
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="text-xs text-[var(--text-muted)] font-semibold">Fontes Conectadas</div>
          <div className="text-3xl font-extrabold mt-1">
            {ops?.sources.filter((s) => s.status === 'ok').length ?? 0}/{ops?.sources.length ?? 0}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Auditoria de URLs: {ops?.linkAudit.healthyCount ?? 0}/{ops?.linkAudit.checkedCount ?? 0} OK
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="text-xs text-[var(--text-muted)] font-semibold">Programas CPF Ativos</div>
          <div className="text-3xl font-extrabold mt-1">
            {configuredCount}/{ops?.affiliatePrograms.length ?? 6}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {configuredCount === 0 ? 'Ação pessoal necessária abaixo' : 'Tags ativas no motor'}
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="text-xs text-[var(--text-muted)] font-semibold">Cliques Locais / Posts Prontos</div>
          <div className="text-3xl font-extrabold mt-1">
            {clicks.length} / {ops?.queuedPostsCount ?? queue.length}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Disparos Telegram: {ops?.publishedCount ?? 0} neste ciclo
          </div>
        </div>
      </section>

      {/* Alerts */}
      {ops?.warnings && ops.warnings.length > 0 ? (
        <section className="surface-card p-5 border-2" style={{ borderColor: 'var(--color-amber)' }}>
          <h2 className="text-base font-bold m-0 mb-2" style={{ color: 'var(--color-amber)' }}>
            Alertas Operacionais Reais
          </h2>
          <ul className="m-0 pl-5 text-sm flex flex-col gap-1">
            {ops.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Step-by-step CPF Affiliate Activation */}
      <section className="surface-card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold m-0">Ativação dos Programas em CPF (Investimento R$ 0,00)</h2>
          <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
            O site já está estruturado e publicado para ser informado como seu canal oficial nos cadastros abaixo:{' '}
            <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">{siteUrl}/</code>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ops?.affiliatePrograms.map((prog) => (
            <div key={prog.id} className="surface-subtle p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{prog.label}</strong>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: prog.configured ? '#047857' : '#b45309' }}
                  >
                    {prog.configured ? 'Ativo' : 'Pendente CPF'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2 flex flex-col gap-1">
                  <span>• Aceita CPF: {prog.acceptsCpf ? 'Sim' : 'Não'}</span>
                  <span>• Comissão estimada: {prog.commissionRange}</span>
                  <span>• Saque mínimo: R$ {prog.minPayoutBrl}</span>
                  <span>
                    • Variável: <code className="text-[11px]">{prog.envVar}</code>
                  </span>
                </div>
              </div>
              <a
                href={prog.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs"
              >
                Abrir Cadastro Oficial →
              </a>
            </div>
          ))}
        </div>

        <div className="surface-subtle p-4 flex flex-col gap-2">
          <strong className="text-xs">1) Ativar cron automático de 6h na nuvem (GitHub Actions):</strong>
          <pre className="m-0 p-3 rounded bg-[#0f172a] text-[#e2e8f0] text-xs overflow-x-auto">
{`gh auth refresh -h github.com -s workflow
npm.cmd run activate-cloud`}
          </pre>
          <strong className="text-xs mt-2">2) Gravar seus IDs de afiliado após aprovação em CPF (ou rode npm.cmd run configure):</strong>
          <pre className="m-0 p-3 rounded bg-[#0f172a] text-[#e2e8f0] text-xs overflow-x-auto">
{`gh variable set AMAZON_PARTNER_TAG --repo renddre2/radarsmart-br --body "SUA_TAG-20"
gh variable set MAGALU_STORE_SLUG --repo renddre2/radarsmart-br --body "seu_slug_magalu"
gh variable set AWIN_AFFILIATE_ID --repo renddre2/radarsmart-br --body "SEU_ID_AWIN"
gh variable set TELEGRAM_CHAT_ID --repo renddre2/radarsmart-br --body "@seu_canal_ofertas"
gh secret set TELEGRAM_BOT_TOKEN --repo renddre2/radarsmart-br --body "SEU_TOKEN_BOTFATHER"`}
          </pre>
        </div>
      </section>

      {/* Ready-to-Post Multichannel Content Queue */}
      <section className="surface-card p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold m-0">Central de Conteúdo Pronto (Telegram, WhatsApp, TikTok/Reels, Instagram)</h2>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              Motor de copy: {ops?.llmEnrichmentStatus ?? 'determinístico'}. Copie com 1 clique ou conecte o Bot do Telegram para disparo automático a cada 6h.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href={withBasePath('/feed.xml')} className="btn-secondary text-xs">
              RSS (/feed.xml)
            </a>
            <a href={withBasePath('/api/deals.json')} className="btn-secondary text-xs">
              JSON (/api/deals.json)
            </a>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {queue.slice(0, 6).map((post) => (
            <div key={post.offerId} className="surface-subtle p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--color-brand)]">
                    Score {post.opportunityScore}/100 • {post.storeName} • {formatBrl(post.price)}
                  </div>
                  <Link href={`/oferta/${post.slug}/`} className="font-bold text-sm text-[var(--text-main)] no-underline hover:underline">
                    {post.title}
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(`${post.offerId}-wa`, post.whatsappText)}
                  className="btn-primary text-xs"
                >
                  {copiedKey === `${post.offerId}-wa` ? 'Copiado!' : 'Copiar WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(`${post.offerId}-tg`, post.telegramHtml)}
                  className="btn-secondary text-xs"
                >
                  {copiedKey === `${post.offerId}-tg` ? 'Copiado!' : 'Copiar Telegram HTML'}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(`${post.offerId}-vid`, post.shortVideoScript)}
                  className="btn-secondary text-xs"
                >
                  {copiedKey === `${post.offerId}-vid` ? 'Copiado!' : 'Copiar Roteiro Shorts/TikTok'}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(`${post.offerId}-ig`, post.instagramCaption)}
                  className="btn-secondary text-xs"
                >
                  {copiedKey === `${post.offerId}-ig` ? 'Copiado!' : 'Copiar Legenda IG'}
                </button>
              </div>

              <pre className="m-0 p-2.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] whitespace-pre-wrap font-sans max-h-36 overflow-y-auto">
                {post.whatsappText}
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* Source Health Table */}
      <section className="flex flex-col gap-3">
        <h2 id="health-table-caption" className="text-xl font-bold m-0">
          Saúde das Fontes &amp; Conectores Oficiais
        </h2>
        <div tabIndex={0} role="region" aria-labelledby="health-table-caption" className="table-wrapper">
          <table className="radar-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Estado</th>
                <th>Latência</th>
                <th>Aceitas / Rejeitadas</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {ops?.sources.map((src) => (
                <tr key={src.sourceId}>
                  <th>{src.sourceName}</th>
                  <td>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{
                        backgroundColor:
                          src.status === 'ok'
                            ? '#047857'
                            : src.status === 'awaiting_credentials'
                              ? '#0369a1'
                              : '#b45309',
                      }}
                    >
                      {src.status}
                    </span>
                  </td>
                  <td>{src.latencyMs} ms</td>
                  <td>
                    {src.acceptedOffersCount} / {src.rejectedItemsCount}
                  </td>
                  <td className="text-xs text-[var(--text-muted)]">{src.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Revenue Simulator + Click Telemetry + Strategy Weights */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold m-0">Simulador Comercial &amp; Metas (CPF)</h2>
          <p className="text-xs text-[var(--text-muted)] m-0">
            Ticket médio atual do radar: <strong>{formatBrl(avgTicket)}</strong>. Simule quanto seu tráfego orgânico (Google SEO + Telegram + Shorts) pode gerar:
          </p>
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <label className="surface-subtle p-3 flex flex-col gap-1">
              <span>Cliques/mês</span>
              <input
                type="number"
                min={50}
                step={50}
                value={manualClicksPerMonth}
                onChange={(e) => setManualClicksPerMonth(Number(e.target.value))}
                className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-sm"
              />
            </label>
            <label className="surface-subtle p-3 flex flex-col gap-1">
              <span>Conversão (%)</span>
              <input
                type="number"
                min={0.5}
                max={15}
                step={0.5}
                value={avgConvPct}
                onChange={(e) => setAvgConvPct(Number(e.target.value))}
                className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-sm"
              />
            </label>
            <label className="surface-subtle p-3 flex flex-col gap-1">
              <span>Comissão (%)</span>
              <input
                type="number"
                min={1}
                max={16}
                step={0.5}
                value={avgCommPct}
                onChange={(e) => setAvgCommPct(Number(e.target.value))}
                className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div className="surface-subtle p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Vendas estimadas / mês</div>
              <div className="text-2xl font-extrabold">{projectedSales} celulares</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)]">Receita bruta estimada</div>
              <div className="text-2xl font-extrabold" style={{ color: 'var(--color-emerald)' }}>
                {formatBrl(projectedRevenue)}
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold m-0">Cliques Registrados &amp; Aprendizado</h2>
            <button
              type="button"
              onClick={() => copyText('feedback-json', feedbackJsonString)}
              className="btn-secondary text-xs"
            >
              {copiedKey === 'feedback-json' ? 'JSON Copiado!' : 'Copiar JSON p/ Learner'}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] m-0">
            Cliques registrados neste navegador: <strong>{clicks.length}</strong>. Pesos comerciais atuais ({weights?.notes ?? 'ativos'}):
          </p>
          <div className="text-xs surface-subtle p-3">
            <strong>Multiplicadores por faixa:</strong>{' '}
            {weights
              ? Object.entries(weights.priceBandMultipliers)
                  .map(([k, v]) => `${k}: ${v}x`)
                  .join(' | ')
              : '—'}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Últimos registros da fila/publicações ({ledger.length}):{' '}
            {ledger.slice(-3).map((l) => `${l.channel}:${l.status}`).join(', ') || 'nenhum'}
          </div>
        </div>
      </section>
    </div>
  );
}
