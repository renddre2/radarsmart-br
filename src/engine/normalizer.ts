import type { NormalizedOffer, PhoneCondition, PriceBand, RawStoreItem } from '@/types/domain';
import { resolveSpecsFromTitle } from './specsDb';

const BLOCKED_KEYWORDS_REGEX =
  /\b(pel[ií]cula|capinha|capa\s|case\s|carregador|cabo\s|suporte\s|pneu|impressora|smartwatch|rel[oó]gio|tablet|ipad|caixa\s+vazia|tela\s+frontal|display\s+lcd|bateria\s+para|conector|fone\s+de\s+ouvido|airpods|moto\s+buds\s*2\s*$|teste\s+prod|conjunto\s+de\s+\d+\s+acess[oó]rios|adesivo|bra[cç]adeira|adaptador|power\s*bank|trip[eé]|ring\s+light)\b/i;

const PHONE_SIGNAL_REGEX =
  /\b(smartphone|iphone|galaxy\s*[aszm]|moto\s*[ge]|motorola\s*edge|motorola\s*razr|poco\s*[xfm]|redmi\s*note|xiaomi\s*\d|realme\s*\d|celular)\b/i;

const ACCESSORY_CATEGORY_REGEX =
  /(acess[oó]rios|capinhas|pel[ií]culas|pneus|inform[aá]tica\/impressoras|smartwatch|audio|áudio)/i;

const REFURBISHED_REGEX =
  /\b(recondicionado|seminovo|usado|vitrine|outlet\s*-\s*(bom|muito bom|excelente))\b/i;

const MIN_SMARTPHONE_PRICE_BRL = 450;
const MAX_SMARTPHONE_PRICE_BRL = 18500;

export function isValidSmartphoneOffer(item: RawStoreItem): { valid: boolean; reason?: string } {
  if (!item.title || item.title.trim().length < 6) {
    return { valid: false, reason: 'título vazio ou curto demais' };
  }
  if (!Number.isFinite(item.price) || item.price < MIN_SMARTPHONE_PRICE_BRL || item.price > MAX_SMARTPHONE_PRICE_BRL) {
    return { valid: false, reason: `preço fora da faixa de smartphone (R$ ${item.price})` };
  }
  if (!Number.isFinite(item.availableQuantity) || item.availableQuantity <= 0) {
    return { valid: false, reason: 'sem estoque disponível' };
  }
  if (BLOCKED_KEYWORDS_REGEX.test(item.title)) {
    return { valid: false, reason: 'palavra-chave bloqueada (acessório/teste/não-celular)' };
  }
  const catJoined = item.categories.join(' | ');
  if (ACCESSORY_CATEGORY_REGEX.test(catJoined) && !/\b(smartphone|iphone)\b/i.test(item.title)) {
    return { valid: false, reason: 'categoria de acessório ou não-celular' };
  }
  if (!PHONE_SIGNAL_REGEX.test(item.title)) {
    return { valid: false, reason: 'título não confirma que é smartphone' };
  }
  if (!item.productUrl || !item.productUrl.startsWith('https://')) {
    return { valid: false, reason: 'URL de produto inválida' };
  }
  return { valid: true };
}

export function inferBrand(item: RawStoreItem): string {
  const t = `${item.brand} ${item.title}`.toLowerCase();
  if (t.includes('apple') || t.includes('iphone')) return 'Apple';
  if (t.includes('samsung') || t.includes('galaxy')) return 'Samsung';
  if (t.includes('motorola') || /\bmoto\s*[ge]\d|\bedge\s*\d|\brazr\b/i.test(t)) return 'Motorola';
  if (t.includes('xiaomi') || t.includes('poco') || t.includes('redmi')) return 'Xiaomi';
  if (t.includes('realme')) return 'Realme';
  return item.brand?.trim() || 'Outra';
}

export function inferCondition(item: RawStoreItem): PhoneCondition {
  if (item.storeKey === 'trocafone' || REFURBISHED_REGEX.test(item.title)) {
    return 'recondicionado';
  }
  return 'novo';
}

export function inferPriceBand(price: number): PriceBand {
  if (price <= 1200) return 'ate-1200';
  if (price <= 2200) return '1200-2200';
  if (price <= 4000) return '2200-4000';
  return 'acima-4000';
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function normalizeRawItem(item: RawStoreItem): NormalizedOffer | null {
  const check = isValidSmartphoneOffer(item);
  if (!check.valid) return null;

  const brand = inferBrand(item);
  const condition = inferCondition(item);
  const specs = resolveSpecsFromTitle(item.title, brand);
  const isBundle = /^\s*kit\b|\+\s*moto\s*buds|\+\s*fone/i.test(item.title);
  const effectivePrice = Number((item.pixPrice && item.pixPrice < item.price ? item.pixPrice : item.price).toFixed(2));
  const safeListPrice = item.listPrice >= effectivePrice ? Number(item.listPrice.toFixed(2)) : effectivePrice;
  const rawDiscount = safeListPrice > effectivePrice
    ? Math.round(((safeListPrice - effectivePrice) / safeListPrice) * 100)
    : 0;

  const storageTag = specs.storageGb ? `${specs.storageGb}gb` : 'std';
  const canonicalKey = slugify(`${specs.canonicalModel}-${storageTag}-${condition}`);
  const id = `${item.storeKey}-${item.productId}-${item.skuId}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const slug = `${slugify(`${specs.canonicalModel}-${storageTag}-${item.storeKey}`)}-${item.productId}`.slice(0, 88);

  return {
    id,
    slug,
    canonicalKey,
    title: cleanTitle(item.title),
    brand,
    storeKey: item.storeKey,
    storeName: item.storeName,
    condition,
    isBundle,
    price: Number(item.price.toFixed(2)),
    listPrice: safeListPrice,
    effectivePrice,
    discountPct: rawDiscount,
    priceBand: inferPriceBand(effectivePrice),
    availableQuantity: item.availableQuantity,
    imageUrl: sanitizeImageUrl(item.imageUrl),
    originalUrl: item.productUrl,
    monetizedUrl: item.productUrl,
    monetizedProgram: 'direto-sem-tag',
    isDirectlyMonetized: false,
    comparisonLinks: [],
    specs,
    priceStats: {
      minObservedPrice: effectivePrice,
      maxObservedPrice: safeListPrice,
      avgObservedPrice: effectivePrice,
      observationsCount: 1,
      suspiciousListPrice: false,
      verifiedDiscountPct: rawDiscount,
      priceAlertLabel: 'Primeira leitura verificada',
    },
    opportunityScore: 50,
    scoreBreakdown: {
      technical: specs.baseTechnicalScore,
      discount: 0,
      trust: 12,
      commercial: 8,
    },
    analysis: {
      verdict: '',
      idealFor: '',
      pros: [],
      watchout: '',
      faqs: [],
    },
    status: 'active',
    observedAt: item.observedAt,
  };
}

function cleanTitle(title: string): string {
  return title
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/""/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

export function deduplicateOffers(offers: NormalizedOffer[]): NormalizedOffer[] {
  const byModelStore = new Map<string, NormalizedOffer>();
  for (const offer of offers) {
    // Keep best priced offer per canonicalKey + store + bundle flag
    const dedupKey = `${offer.canonicalKey}::${offer.storeKey}::${offer.isBundle ? 'kit' : 'solo'}`;
    const existing = byModelStore.get(dedupKey);
    if (!existing || offer.effectivePrice < existing.effectivePrice) {
      byModelStore.set(dedupKey, offer);
    }
  }
  return Array.from(byModelStore.values());
}
