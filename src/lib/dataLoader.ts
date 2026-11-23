import fs from 'node:fs';
import path from 'node:path';
import type {
  GeneratedGuide,
  MarketPulseItem,
  NormalizedOffer,
  OpsReport,
  PriceHistoryMap,
  PublishedLedgerEntry,
  SocialPostAsset,
  StrategyWeights,
} from '@/types/domain';

const DATA_DIR = path.join(process.cwd(), 'data');

function readJsonSync<T>(filename: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getActiveOffers(): NormalizedOffer[] {
  return readJsonSync<NormalizedOffer[]>('offers.json', []);
}

export function getExpiredOffers(): NormalizedOffer[] {
  return readJsonSync<NormalizedOffer[]>('expired-offers.json', []);
}

export function getAllKnownOffers(): NormalizedOffer[] {
  return [...getActiveOffers(), ...getExpiredOffers()];
}

export function getOfferBySlug(slug: string): NormalizedOffer | undefined {
  return getAllKnownOffers().find((o) => o.slug === slug);
}

export function getOfferById(id: string): NormalizedOffer | undefined {
  return getAllKnownOffers().find((o) => o.id === id);
}

export function getGuides(): GeneratedGuide[] {
  return readJsonSync<GeneratedGuide[]>('guides.json', []);
}

export function getGuideBySlug(slug: string): GeneratedGuide | undefined {
  return getGuides().find((g) => g.slug === slug);
}

export function getContentQueue(): SocialPostAsset[] {
  return readJsonSync<SocialPostAsset[]>('content-queue.json', []);
}

export function getMarketPulse(): MarketPulseItem[] {
  return readJsonSync<MarketPulseItem[]>('market-pulse.json', []);
}

export function getPublishedLedger(): PublishedLedgerEntry[] {
  return readJsonSync<PublishedLedgerEntry[]>('published-ledger.json', []);
}

export function getPriceHistory(): PriceHistoryMap {
  return readJsonSync<PriceHistoryMap>('price-history.json', { updatedAt: '', records: {} });
}

export function getStrategyWeights(): StrategyWeights | null {
  return readJsonSync<StrategyWeights | null>('strategy-weights.json', null);
}

export function getOpsReport(): OpsReport | null {
  return readJsonSync<OpsReport | null>('ops-report.json', null);
}

export { getSiteUrl, getBasePath, withBasePath } from './sitePaths';
