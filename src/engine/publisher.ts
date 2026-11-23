import type {
  NormalizedOffer,
  OpsReport,
  PublishedLedgerEntry,
  SocialPostAsset,
  SourceHealthReport,
} from '@/types/domain';
import { fetchWithTimeout } from './collectors/vtexCollector';
import { getAffiliateProgramsStatus } from './affiliateLinks';

const MAX_POSTS_PER_CYCLE = 3;
const MIN_SCORE_TO_PUBLISH = 70;
const MIN_PRICE_DROP_REPOST_PCT = 8;

export function selectPostsToPublish(
  queue: SocialPostAsset[],
  ledger: PublishedLedgerEntry[],
  nowMs: number = Date.now(),
): SocialPostAsset[] {
  const recentWindowMs = 72 * 3600 * 1000;
  const selected: SocialPostAsset[] = [];

  for (const post of queue) {
    if (selected.length >= MAX_POSTS_PER_CYCLE) break;
    if (post.opportunityScore < MIN_SCORE_TO_PUBLISH) continue;

    const priorEntries = ledger.filter((l) => l.offerId === post.offerId && l.status === 'sent');
    const latest = priorEntries[priorEntries.length - 1];
    if (latest) {
      const ageMs = nowMs - new Date(latest.publishedAt).getTime();
      const dropPct =
        latest.publishedPrice > 0
          ? ((latest.publishedPrice - post.price) / latest.publishedPrice) * 100
          : 0;
      if (ageMs < recentWindowMs && dropPct < MIN_PRICE_DROP_REPOST_PCT) {
        continue;
      }
    }
    selected.push(post);
  }

  return selected;
}

export async function publishEligiblePosts(
  queue: SocialPostAsset[],
  ledger: PublishedLedgerEntry[],
  nowIso: string,
): Promise<{ nextLedger: PublishedLedgerEntry[]; publishedCount: number }> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? '').trim();
  const webhookUrl = (process.env.WEBHOOK_URL ?? '').trim();

  const eligible = selectPostsToPublish(queue, ledger, new Date(nowIso).getTime());
  const nextLedger = [...ledger];
  let publishedCount = 0;

  if (eligible.length === 0) {
    return { nextLedger, publishedCount: 0 };
  }

  if (!botToken || !chatId) {
    for (const item of eligible) {
      const alreadyStaged = nextLedger.some(
        (l) => l.offerId === item.offerId && l.status === 'staged_in_queue' && l.publishedAt.slice(0, 10) === nowIso.slice(0, 10),
      );
      if (!alreadyStaged) {
        nextLedger.push({
          offerId: item.offerId,
          canonicalKey: item.slug,
          channel: 'staged',
          publishedPrice: item.price,
          publishedAt: nowIso,
          status: 'staged_in_queue',
          detail: 'Pronto na fila multicanal (aguardando TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID para disparo automático).',
        });
      }
    }
    return { nextLedger: nextLedger.slice(-200), publishedCount: 0 };
  }

  for (const item of eligible) {
    try {
      const res = await fetchWithTimeout(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: item.telegramHtml,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
        },
        10000,
      );

      if (res.ok) {
        publishedCount += 1;
        nextLedger.push({
          offerId: item.offerId,
          canonicalKey: item.slug,
          channel: 'telegram',
          publishedPrice: item.price,
          publishedAt: nowIso,
          status: 'sent',
          detail: 'Publicado no canal Telegram via Bot API oficial.',
        });
      } else {
        const errBody = await res.text();
        nextLedger.push({
          offerId: item.offerId,
          canonicalKey: item.slug,
          channel: 'telegram',
          publishedPrice: item.price,
          publishedAt: nowIso,
          status: 'failed',
          detail: `HTTP ${res.status}: ${errBody.slice(0, 120)}`,
        });
      }
    } catch (err) {
      nextLedger.push({
        offerId: item.offerId,
        canonicalKey: item.slug,
        channel: 'telegram',
        publishedPrice: item.price,
        publishedAt: nowIso,
        status: 'failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    if (webhookUrl) {
      try {
        await fetchWithTimeout(
          webhookUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          },
          7000,
        );
      } catch {
        // Non-blocking secondary webhook
      }
    }
  }

  return { nextLedger: nextLedger.slice(-200), publishedCount };
}

export async function auditOfferLinks(offers: NormalizedOffer[]): Promise<{
  checkedCount: number;
  healthyCount: number;
  brokenUrls: string[];
}> {
  const sample = offers.slice(0, 6);
  let healthyCount = 0;
  const brokenUrls: string[] = [];

  for (const offer of sample) {
    try {
      const res = await fetchWithTimeout(offer.originalUrl, { method: 'HEAD' }, 7000);
      if (res.ok || res.status === 405 || res.status === 403) {
        // Many Brazilian retail CDNs respond 403/405 to automated HEAD even when valid for browsers
        healthyCount += 1;
      } else if (res.status >= 400) {
        brokenUrls.push(`${offer.storeName}: ${offer.originalUrl} (HTTP ${res.status})`);
      }
    } catch {
      brokenUrls.push(`${offer.storeName}: ${offer.originalUrl} (timeout/erro de rede)`);
    }
  }

  return {
    checkedCount: sample.length,
    healthyCount,
    brokenUrls,
  };
}

export function buildOpsReport(params: {
  runId: string;
  executedAt: string;
  durationMs: number;
  activeOffers: NormalizedOffer[];
  expiredOffersCount: number;
  newOffersCount: number;
  guidesCount: number;
  queuedPostsCount: number;
  publishedCount: number;
  llmEnrichmentStatus: string;
  sources: SourceHealthReport[];
  linkAudit: OpsReport['linkAudit'];
}): OpsReport {
  const affiliatePrograms = getAffiliateProgramsStatus();
  const warnings: string[] = [];

  const configuredProgramsCount = affiliatePrograms.filter((p) => p.configured).length;
  if (configuredProgramsCount === 0) {
    warnings.push(
      'Nenhuma tag de afiliado configurada ainda — links funcionam para compra e comparação, mas exigem cadastro pessoal (CPF) no Painel Central para gerar comissões.',
    );
  }
  for (const src of params.sources) {
    if (src.status === 'error') {
      warnings.push(`Fonte ${src.sourceName} falhou neste ciclo: ${src.message}`);
    }
  }
  if (params.linkAudit.brokenUrls.length > 0) {
    warnings.push(`${params.linkAudit.brokenUrls.length} URL(s) falharam na auditoria.`);
  }

  return {
    runId: params.runId,
    executedAt: params.executedAt,
    durationMs: params.durationMs,
    activeOffersCount: params.activeOffers.length,
    expiredOffersCount: params.expiredOffersCount,
    newOffersCount: params.newOffersCount,
    guidesCount: params.guidesCount,
    queuedPostsCount: params.queuedPostsCount,
    publishedCount: params.publishedCount,
    llmEnrichmentStatus: params.llmEnrichmentStatus,
    sources: params.sources,
    affiliatePrograms,
    linkAudit: params.linkAudit,
    warnings,
  };
}
