import type { RawStoreItem, SourceHealthReport, StoreKey } from '@/types/domain';
import { isValidSmartphoneOffer } from '@/engine/normalizer';

export interface VtexSourceConfig {
  storeKey: StoreKey;
  storeName: string;
  baseUrl: string;
  queries: string[];
  trustScore: number; // 0-20
}

export const VTEX_SOURCES: VtexSourceConfig[] = [
  {
    storeKey: 'motorola',
    storeName: 'Motorola Oficial',
    baseUrl: 'https://www.motorola.com.br',
    queries: ['motorola', 'moto g', 'edge'],
    trustScore: 20,
  },
  {
    storeKey: 'fastshop',
    storeName: 'Fast Shop',
    baseUrl: 'https://site.fastshop.com.br',
    queries: ['smartphone samsung', 'iphone', 'smartphone motorola'],
    trustScore: 19,
  },
  {
    storeKey: 'bemol',
    storeName: 'Bemol',
    baseUrl: 'https://www.bemol.com.br',
    queries: ['smartphone samsung', 'iphone apple', 'smartphone motorola'],
    trustScore: 17,
  },
  {
    storeKey: 'angeloni',
    storeName: 'Angeloni Eletro',
    baseUrl: 'https://www.angeloni.com.br/eletro',
    queries: ['smartphone samsung', 'iphone', 'smartphone motorola'],
    trustScore: 16,
  },
  {
    storeKey: 'fujioka',
    storeName: 'Fujioka',
    baseUrl: 'https://www.fujioka.com.br',
    queries: ['smartphone samsung', 'smartphone motorola', 'iphone'],
    trustScore: 16,
  },
  {
    storeKey: 'trocafone',
    storeName: 'Trocafone (Recondicionado)',
    baseUrl: 'https://www.trocafone.com.br',
    queries: ['samsung', 'iphone', 'motorola'],
    trustScore: 15,
  },
];

interface VtexOffer {
  Price?: number;
  ListPrice?: number;
  AvailableQuantity?: number;
  PaymentSystemName?: string;
  Teasers?: Array<{ Effects?: { Parameters?: Array<{ Name?: string; Value?: string }> } }>;
  Installments?: Array<{ Value?: number; NumberOfInstallments?: number; PaymentSystemName?: string }>;
}

interface VtexProduct {
  productId?: string;
  productName?: string;
  brand?: string;
  categories?: string[];
  link?: string;
  description?: string;
  items?: Array<{
    itemId?: string;
    images?: Array<{ imageUrl?: string }>;
    sellers?: Array<{ commertialOffer?: VtexOffer }>;
  }>;
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': 'RadarSmartBR/1.0 (+https://renddre2.github.io/radarsmart-br)',
        Accept: 'application/json, text/xml, */*',
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function extractVtexPixPrice(offer: VtexOffer, fallbackPrice: number): number | undefined {
  const installments = offer.Installments ?? [];
  let minPix: number | undefined;
  for (const inst of installments) {
    const name = (inst.PaymentSystemName ?? '').toLowerCase();
    if ((name.includes('pix') || name.includes('boleto') || name.includes('à vista')) && inst.NumberOfInstallments === 1 && typeof inst.Value === 'number' && inst.Value > 400 && inst.Value < fallbackPrice) {
      if (minPix === undefined || inst.Value < minPix) {
        minPix = inst.Value;
      }
    }
  }
  return minPix;
}

export function parseVtexProducts(
  source: VtexSourceConfig,
  products: VtexProduct[],
  observedAt: string,
): { rawItems: RawStoreItem[]; rejectedCount: number } {
  const rawItems: RawStoreItem[] = [];
  let rejectedCount = 0;

  for (const p of products) {
    const firstItem = p.items?.[0];
    const offer = firstItem?.sellers?.[0]?.commertialOffer;
    if (!p.productId || !p.productName || !firstItem?.itemId || !offer) {
      rejectedCount += 1;
      continue;
    }

    const price = Number(offer.Price ?? 0);
    const listPrice = Number(offer.ListPrice ?? price);
    const availableQuantity = Number(offer.AvailableQuantity ?? 0);
    const rawUrl = p.link?.startsWith('http') ? p.link : `${source.baseUrl}${p.link ?? ''}`;
    const imageUrl = firstItem.images?.[0]?.imageUrl ?? '';

    const candidate: RawStoreItem = {
      storeKey: source.storeKey,
      storeName: source.storeName,
      productId: String(p.productId),
      skuId: String(firstItem.itemId),
      title: String(p.productName),
      brand: String(p.brand ?? ''),
      categories: Array.isArray(p.categories) ? p.categories : [],
      price,
      listPrice,
      pixPrice: extractVtexPixPrice(offer, price),
      availableQuantity,
      imageUrl,
      productUrl: rawUrl.replace(/^http:\/\//i, 'https://'),
      description: p.description ? String(p.description).replace(/<[^>]+>/g, ' ').slice(0, 400) : undefined,
      observedAt,
    };

    const check = isValidSmartphoneOffer(candidate);
    if (check.valid) {
      rawItems.push(candidate);
    } else {
      rejectedCount += 1;
    }
  }

  return { rawItems, rejectedCount };
}

export async function collectVtexSource(
  source: VtexSourceConfig,
  observedAt: string,
): Promise<{ items: RawStoreItem[]; health: SourceHealthReport }> {
  const start = Date.now();
  const collected: RawStoreItem[] = [];
  let totalRaw = 0;
  let totalRejected = 0;
  const errors: string[] = [];

  for (const query of source.queries) {
    const url = `${source.baseUrl}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?_from=0&_to=16`;
    try {
      const res = await fetchWithTimeout(url, {}, 11000);
      if (!res.ok && res.status !== 206) {
        errors.push(`${query}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as VtexProduct[];
      if (!Array.isArray(data)) {
        errors.push(`${query}: payload não é array`);
        continue;
      }
      totalRaw += data.length;
      const parsed = parseVtexProducts(source, data, observedAt);
      collected.push(...parsed.rawItems);
      totalRejected += parsed.rejectedCount;
    } catch (err) {
      errors.push(`${query}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Deduplicate by productId+skuId within the same store
  const unique = new Map<string, RawStoreItem>();
  for (const item of collected) {
    unique.set(`${item.productId}-${item.skuId}`, item);
  }
  const items = Array.from(unique.values());
  const latencyMs = Date.now() - start;

  let status: SourceHealthReport['status'] = 'ok';
  let message = `${items.length} smartphones ativos verificados.`;
  if (items.length === 0 && errors.length > 0) {
    status = 'error';
    message = errors.join(' | ');
  } else if (errors.length > 0) {
    status = 'degraded';
    message = `${items.length} ofertas; avisos parciais: ${errors.join(' | ')}`;
  }

  return {
    items,
    health: {
      sourceId: source.storeKey,
      sourceName: source.storeName,
      status,
      latencyMs,
      rawItemsCount: totalRaw,
      acceptedOffersCount: items.length,
      rejectedItemsCount: totalRejected,
      message,
      checkedAt: observedAt,
    },
  };
}

export async function collectAllVtexSources(observedAt: string): Promise<{
  items: RawStoreItem[];
  healthReports: SourceHealthReport[];
}> {
  const results = await Promise.allSettled(
    VTEX_SOURCES.map((source) => collectVtexSource(source, observedAt)),
  );

  const items: RawStoreItem[] = [];
  const healthReports: SourceHealthReport[] = [];

  results.forEach((result, idx) => {
    const source = VTEX_SOURCES[idx];
    if (result.status === 'fulfilled') {
      items.push(...result.value.items);
      healthReports.push(result.value.health);
    } else {
      healthReports.push({
        sourceId: source.storeKey,
        sourceName: source.storeName,
        status: 'error',
        latencyMs: 0,
        rawItemsCount: 0,
        acceptedOffersCount: 0,
        rejectedItemsCount: 0,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        checkedAt: observedAt,
      });
    }
  });

  return { items, healthReports };
}
