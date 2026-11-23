import crypto from 'node:crypto';
import type { RawStoreItem, SourceHealthReport } from '@/types/domain';
import { isValidSmartphoneOffer } from '@/engine/normalizer';
import { fetchWithTimeout } from './vtexCollector';

export const SHOPEE_GRAPHQL_ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

export function buildShopeeAuthHeader(params: {
  appId: string;
  secret: string;
  payload: string;
  timestampSec?: number;
}): { header: string; timestamp: number; signature: string } {
  const timestamp = params.timestampSec ?? Math.floor(Date.now() / 1000);
  const raw = `${params.appId}${timestamp}${params.payload}${params.secret}`;
  const signature = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  const header = `SHA256 Credential=${params.appId}, Timestamp=${timestamp}, Signature=${signature}`;
  return { header, timestamp, signature };
}

interface ShopeeProductNode {
  itemId?: string | number;
  productName?: string;
  commissionRate?: string | number;
  priceMin?: string | number;
  priceMax?: string | number;
  imageUrl?: string;
  offerLink?: string;
  productLink?: string;
  sales?: number;
}

export async function collectShopeeOffers(observedAt: string): Promise<{
  items: RawStoreItem[];
  health: SourceHealthReport;
}> {
  const start = Date.now();
  const appId = (process.env.SHOPEE_APP_ID ?? '').trim();
  const secret = (process.env.SHOPEE_APP_SECRET ?? '').trim();

  if (!appId || !secret) {
    return {
      items: [],
      health: {
        sourceId: 'shopee',
        sourceName: 'Shopee Affiliate Open API',
        status: 'awaiting_credentials',
        latencyMs: 0,
        rawItemsCount: 0,
        acceptedOffersCount: 0,
        rejectedItemsCount: 0,
        message: 'Aguardando SHOPEE_APP_ID e SHOPEE_APP_SECRET (cadastro gratuito com CPF em affiliate.shopee.com.br).',
        checkedAt: observedAt,
      },
    };
  }

  const query = `
    query SmartphoneOffers($keyword: String!) {
      productOfferV2(keyword: $keyword, sortType: 2, page: 1, limit: 15) {
        nodes {
          itemId
          productName
          commissionRate
          priceMin
          priceMax
          imageUrl
          offerLink
          productLink
          sales
        }
      }
    }
  `;

  const collected: RawStoreItem[] = [];
  let rawCount = 0;
  let rejectedCount = 0;
  const errors: string[] = [];

  for (const keyword of ['smartphone samsung 5g', 'smartphone motorola 5g', 'iphone apple']) {
    const payload = JSON.stringify({ query, variables: { keyword } });
    const { header } = buildShopeeAuthHeader({ appId, secret, payload });

    try {
      const res = await fetchWithTimeout(
        SHOPEE_GRAPHQL_ENDPOINT,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: header,
          },
          body: payload,
        },
        10000,
      );

      if (!res.ok) {
        errors.push(`${keyword}: HTTP ${res.status}`);
        continue;
      }

      const json = (await res.json()) as {
        data?: { productOfferV2?: { nodes?: ShopeeProductNode[] } };
        errors?: Array<{ message?: string }>;
      };

      if (json.errors?.length) {
        errors.push(`${keyword}: ${json.errors.map((e) => e.message).join('; ')}`);
        continue;
      }

      const nodes = json.data?.productOfferV2?.nodes ?? [];
      rawCount += nodes.length;
      for (const n of nodes) {
        const price = Number(n.priceMin ?? 0);
        const listPrice = Number(n.priceMax ?? price);
        const item: RawStoreItem = {
          storeKey: 'shopee',
          storeName: 'Shopee Oficial / Parceiros',
          productId: String(n.itemId ?? ''),
          skuId: String(n.itemId ?? ''),
          title: String(n.productName ?? ''),
          brand: '',
          categories: ['/Celulares e Dispositivos/Smartphones/'],
          price,
          listPrice: listPrice >= price ? listPrice : price,
          availableQuantity: 10,
          imageUrl: String(n.imageUrl ?? ''),
          productUrl: String(n.offerLink || n.productLink || ''),
          commissionRateHint: Number(n.commissionRate ?? 0),
          observedAt,
        };
        if (isValidSmartphoneOffer(item).valid) {
          collected.push(item);
        } else {
          rejectedCount += 1;
        }
      }
    } catch (err) {
      errors.push(`${keyword}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    items: collected,
    health: {
      sourceId: 'shopee',
      sourceName: 'Shopee Affiliate Open API',
      status: collected.length > 0 ? (errors.length ? 'degraded' : 'ok') : 'error',
      latencyMs: Date.now() - start,
      rawItemsCount: rawCount,
      acceptedOffersCount: collected.length,
      rejectedItemsCount: rejectedCount,
      message: errors.length ? errors.join(' | ') : `${collected.length} ofertas Shopee GraphQL coletadas.`,
      checkedAt: observedAt,
    },
  };
}
