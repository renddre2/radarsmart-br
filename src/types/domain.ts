export type StoreKey =
  | 'motorola'
  | 'fastshop'
  | 'trocafone'
  | 'bemol'
  | 'angeloni'
  | 'fujioka'
  | 'shopee';

export type PhoneCondition = 'novo' | 'recondicionado';

export type PriceBand = 'ate-1200' | '1200-2200' | '2200-4000' | 'acima-4000';

export interface RawStoreItem {
  storeKey: StoreKey;
  storeName: string;
  productId: string;
  skuId: string;
  title: string;
  brand: string;
  categories: string[];
  price: number;
  listPrice: number;
  pixPrice?: number;
  availableQuantity: number;
  imageUrl: string;
  productUrl: string;
  description?: string;
  commissionRateHint?: number;
  observedAt: string;
}

export interface PhoneSpecs {
  canonicalModel: string;
  storageGb: number | null;
  ramGb: number | null;
  has5g: boolean;
  hasNfc: boolean;
  screenSummary: string;
  batteryMah: number | null;
  cameraSummary: string;
  chipset: string;
  os: 'Android' | 'iOS';
  anatelNote: string;
  baseTechnicalScore: number; // 0-35
}

export interface StoreComparisonLink {
  storeId: string;
  storeLabel: string;
  program: string;
  url: string;
  monetized: boolean;
  estimatedCommissionPct: string;
  note: string;
}

export interface PriceStats {
  minObservedPrice: number;
  maxObservedPrice: number;
  avgObservedPrice: number;
  observationsCount: number;
  suspiciousListPrice: boolean;
  verifiedDiscountPct: number;
  priceAlertLabel: string;
}

export interface OfferAnalysis {
  verdict: string;
  idealFor: string;
  pros: string[];
  watchout: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface NormalizedOffer {
  id: string;
  slug: string;
  canonicalKey: string;
  title: string;
  brand: string;
  storeKey: StoreKey;
  storeName: string;
  condition: PhoneCondition;
  isBundle: boolean;
  price: number;
  listPrice: number;
  effectivePrice: number;
  discountPct: number;
  priceBand: PriceBand;
  availableQuantity: number;
  imageUrl: string;
  originalUrl: string;
  monetizedUrl: string;
  monetizedProgram: string;
  isDirectlyMonetized: boolean;
  comparisonLinks: StoreComparisonLink[];
  specs: PhoneSpecs;
  priceStats: PriceStats;
  opportunityScore: number; // 0-100
  scoreBreakdown: {
    technical: number;
    discount: number;
    trust: number;
    commercial: number;
  };
  analysis: OfferAnalysis;
  status: 'active' | 'expired';
  replacementOfferId?: string;
  replacementSlug?: string;
  observedAt: string;
  expiredAt?: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
  listPrice: number;
  storeKey: StoreKey;
}

export interface PriceHistoryRecord {
  canonicalKey: string;
  canonicalModel: string;
  minObservedPrice: number;
  maxObservedPrice: number;
  avgObservedPrice: number;
  observationsCount: number;
  lastObservedAt: string;
  points: PriceHistoryPoint[];
}

export interface PriceHistoryMap {
  updatedAt: string;
  records: Record<string, PriceHistoryRecord>;
}

export interface GeneratedGuide {
  slug: string;
  title: string;
  seoDescription: string;
  targetQuery: string;
  updatedAt: string;
  summary: string;
  methodologyNote: string;
  recommendedOfferIds: string[];
  sections: Array<{
    heading: string;
    body: string;
    bulletPoints: string[];
  }>;
  faqs: Array<{ question: string; answer: string }>;
}

export interface SocialPostAsset {
  offerId: string;
  slug: string;
  title: string;
  opportunityScore: number;
  price: number;
  storeName: string;
  telegramHtml: string;
  whatsappText: string;
  shortVideoScript: string;
  instagramCaption: string;
  generatedBy: 'deterministic' | 'github-models' | 'gemini-free';
}

export interface PublishedLedgerEntry {
  offerId: string;
  canonicalKey: string;
  channel: 'telegram' | 'webhook' | 'staged';
  publishedPrice: number;
  publishedAt: string;
  status: 'sent' | 'staged_in_queue' | 'failed';
  detail?: string;
}

export interface SourceHealthReport {
  sourceId: string;
  sourceName: string;
  status: 'ok' | 'degraded' | 'awaiting_credentials' | 'error';
  latencyMs: number;
  rawItemsCount: number;
  acceptedOffersCount: number;
  rejectedItemsCount: number;
  message: string;
  checkedAt: string;
}

export interface MarketPulseItem {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
  snippet: string;
}

export interface StrategyWeights {
  updatedAt: string;
  brandMultipliers: Record<string, number>;
  priceBandMultipliers: Record<PriceBand, number>;
  storeMultipliers: Record<string, number>;
  notes: string;
}

export interface PerformanceFeedbackEntry {
  offerId: string;
  brand: string;
  priceBand: PriceBand;
  storeKey: string;
  clicks: number;
  conversions: number;
  commissionBrl: number;
  recordedAt: string;
}

export interface PerformanceFeedbackFile {
  updatedAt: string;
  entries: PerformanceFeedbackEntry[];
}

export interface AffiliateStatusItem {
  id: string;
  label: string;
  configured: boolean;
  acceptsCpf: boolean;
  commissionRange: string;
  minPayoutBrl: number;
  envVar: string;
  signupUrl: string;
}

export interface OpsReport {
  runId: string;
  executedAt: string;
  durationMs: number;
  activeOffersCount: number;
  expiredOffersCount: number;
  newOffersCount: number;
  guidesCount: number;
  queuedPostsCount: number;
  publishedCount: number;
  llmEnrichmentStatus: string;
  sources: SourceHealthReport[];
  affiliatePrograms: AffiliateStatusItem[];
  linkAudit: {
    checkedCount: number;
    healthyCount: number;
    brokenUrls: string[];
  };
  warnings: string[];
}
