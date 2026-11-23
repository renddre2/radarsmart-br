import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  NormalizedOffer,
  PerformanceFeedbackFile,
  PriceHistoryMap,
  PublishedLedgerEntry,
  StrategyWeights,
} from '@/types/domain';
import { collectAllVtexSources } from './collectors/vtexCollector';
import { collectShopeeOffers } from './collectors/shopeeCollector';
import { collectMarketPulse } from './collectors/rssPulseCollector';
import { deduplicateOffers, normalizeRawItem } from './normalizer';
import { evaluateAndRecordPriceHistory, reconcileExpiredOffers } from './priceHistory';
import { attachAffiliateLinks, readAffiliateEnv } from './affiliateLinks';
import { scoreOffer } from './scorer';
import { recalibrateStrategyWeights } from './strategyLearner';
import { generateDeterministicAnalysis, generateSeoGuides, generateSocialQueue } from './contentGenerator';
import { auditOfferLinks, buildOpsReport, publishEligiblePosts } from './publisher';

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonPretty(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function runAutonomousPipeline(rootDir = process.cwd()) {
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();
  const runId = `run-${nowIso.replace(/[:.]/g, '-')}`;
  const dataDir = path.join(rootDir, 'data');

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://renddre2.github.io/radarsmart-br').replace(/\/$/, '');

  // 1. Load persisted historical state
  const previousActive = await readJsonOrDefault<NormalizedOffer[]>(path.join(dataDir, 'offers.json'), []);
  const previousExpired = await readJsonOrDefault<NormalizedOffer[]>(path.join(dataDir, 'expired-offers.json'), []);
  const previousHistory = await readJsonOrDefault<PriceHistoryMap>(path.join(dataDir, 'price-history.json'), {
    updatedAt: nowIso,
    records: {},
  });
  const previousLedger = await readJsonOrDefault<PublishedLedgerEntry[]>(path.join(dataDir, 'published-ledger.json'), []);
  const weights = await readJsonOrDefault<StrategyWeights>(path.join(dataDir, 'strategy-weights.json'), {
    updatedAt: nowIso,
    brandMultipliers: {},
    priceBandMultipliers: {
      'ate-1200': 1.12,
      '1200-2200': 1.15,
      '2200-4000': 1.05,
      'acima-4000': 0.96,
    },
    storeMultipliers: {},
    notes: 'Default weights',
  });
  const feedback = await readJsonOrDefault<PerformanceFeedbackFile>(path.join(dataDir, 'performance-feedback.json'), {
    updatedAt: nowIso,
    entries: [],
  });

  // 2. Collect from all authorized sources in parallel
  const [vtexRes, shopeeRes, pulseRes] = await Promise.all([
    collectAllVtexSources(nowIso),
    collectShopeeOffers(nowIso),
    collectMarketPulse(nowIso),
  ]);

  const rawItems = [...vtexRes.items, ...shopeeRes.items];
  const allHealth = [...vtexRes.healthReports, shopeeRes.health, pulseRes.health];

  // 3. Normalize & Deduplicate
  const normalizedList = rawItems
    .map(normalizeRawItem)
    .filter((item): item is NormalizedOffer => item !== null);
  const deduped = deduplicateOffers(normalizedList);

  // Safety guard: if all remote APIs failed simultaneously and we already have a prior snapshot, preserve prior active offers as fallback
  if (deduped.length === 0 && previousActive.length > 0) {
    throw new Error('Todas as fontes falharam simultaneamente (0 ofertas válidas coletadas). Abortando gravação para preservar snapshot íntegro.');
  }

  // 4. Price history & anti-"metade do dobro" audit
  const { offers: withHistory, nextHistory } = evaluateAndRecordPriceHistory(deduped, previousHistory, nowIso);

  // 5. Attach official affiliate & multi-store comparison links
  const affiliateEnv = readAffiliateEnv();
  const withLinks = withHistory.map((o) => attachAffiliateLinks(o, affiliateEnv));

  // 6. Score & rank offers
  const scored = withLinks
    .map((o) => scoreOffer(o, weights))
    .map((o) => ({
      ...o,
      analysis: generateDeterministicAnalysis(o),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.effectivePrice - b.effectivePrice);

  // 7. Reconcile expired offers so SEO pages never break
  const { expiredOffers, newlyAddedCount } = reconcileExpiredOffers(
    previousActive,
    scored,
    previousExpired,
    nowIso,
  );

  // 8. Generate SEO guides & social content queue
  const guides = generateSeoGuides(scored, pulseRes.items, nowIso);
  const { queue: socialQueue, llmStatus } = await generateSocialQueue(scored, siteUrl);

  // 9. Publish eligible posts (Telegram/Webhook) or stage cleanly
  const { nextLedger, publishedCount } = await publishEligiblePosts(socialQueue, previousLedger, nowIso);

  // 10. Audit sample outbound URLs & calibrate strategy weights
  const linkAudit = await auditOfferLinks(scored);
  const nextWeights = recalibrateStrategyWeights(weights, feedback, scored, nowIso);

  const opsReport = buildOpsReport({
    runId,
    executedAt: nowIso,
    durationMs: Date.now() - startedAt,
    activeOffers: scored,
    expiredOffersCount: expiredOffers.length,
    newOffersCount: newlyAddedCount,
    guidesCount: guides.length,
    queuedPostsCount: socialQueue.length,
    publishedCount,
    llmEnrichmentStatus: llmStatus,
    sources: allHealth,
    linkAudit,
  });

  // 11. Persist all snapshots
  await Promise.all([
    writeJsonPretty(path.join(dataDir, 'offers.json'), scored),
    writeJsonPretty(path.join(dataDir, 'expired-offers.json'), expiredOffers),
    writeJsonPretty(path.join(dataDir, 'price-history.json'), nextHistory),
    writeJsonPretty(path.join(dataDir, 'guides.json'), guides),
    writeJsonPretty(path.join(dataDir, 'content-queue.json'), socialQueue),
    writeJsonPretty(path.join(dataDir, 'market-pulse.json'), pulseRes.items),
    writeJsonPretty(path.join(dataDir, 'published-ledger.json'), nextLedger),
    writeJsonPretty(path.join(dataDir, 'strategy-weights.json'), nextWeights),
    writeJsonPretty(path.join(dataDir, 'ops-report.json'), opsReport),
  ]);

  return {
    opsReport,
    scoredCount: scored.length,
    topOffer: scored[0] ?? null,
  };
}
