import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeRawItem } from '@/engine/normalizer';
import { attachAffiliateLinks, readAffiliateEnv, wrapAwinDeepLink } from '@/engine/affiliateLinks';
import { buildShopeeAuthHeader } from '@/engine/collectors/shopeeCollector';

describe('Affiliate Link Builder & Shopee SHA-256 Auth', () => {
  const sampleOffer = normalizeRawItem({
    storeKey: 'motorola',
    storeName: 'Motorola Oficial',
    productId: '499',
    skuId: '4991',
    title: 'Smartphone Motorola Edge 70 Fusion 5G 256GB',
    brand: 'Motorola',
    categories: ['/Smartphones/'],
    price: 2249.1,
    listPrice: 3299.0,
    availableQuantity: 50,
    imageUrl: 'https://motorolabr.vtexassets.com/edge70.jpg',
    productUrl: 'https://www.motorola.com.br/edge-70-fusion/p',
    observedAt: '2026-11-23T20:00:00Z',
  })!;

  it('mantém URL direta e sinaliza monetized=false quando sem IDs de afiliado', () => {
    const emptyEnv = readAffiliateEnv({});
    const out = attachAffiliateLinks(sampleOffer, emptyEnv);
    expect(out.isDirectlyMonetized).toBe(false);
    expect(out.monetizedUrl).toBe(sampleOffer.originalUrl);
    expect(out.comparisonLinks.every((c) => c.monetized === false)).toBe(true);
  });

  it('gera tags oficiais Amazon, Magalu, ML, Shopee e Awin deep link quando configurados', () => {
    const cfg = readAffiliateEnv({
      AMAZON_PARTNER_TAG: 'radarsmart-20',
      MAGALU_STORE_SLUG: 'radarsmartloja',
      AWIN_AFFILIATE_ID: '123456',
      AWIN_MID_MOTOROLA: '17655',
      SHOPEE_AFFILIATE_ID: '998877',
      ML_AFFILIATE_MAP_JSON: JSON.stringify({
        [sampleOffer.canonicalKey]: 'https://mercadolivre.com/sec/1AbCdEf',
      }),
    });

    const out = attachAffiliateLinks(sampleOffer, cfg);
    expect(out.isDirectlyMonetized).toBe(true);
    expect(out.monetizedUrl).toBe(
      wrapAwinDeepLink('123456', '17655', 'https://www.motorola.com.br/edge-70-fusion/p'),
    );

    const amazon = out.comparisonLinks.find((c) => c.storeId === 'amazon')!;
    const magalu = out.comparisonLinks.find((c) => c.storeId === 'magalu')!;
    const ml = out.comparisonLinks.find((c) => c.storeId === 'mercadolivre')!;
    const shopee = out.comparisonLinks.find((c) => c.storeId === 'shopee')!;

    expect(amazon.monetized).toBe(true);
    expect(amazon.url).toContain('tag=radarsmart-20');
    expect(magalu.monetized).toBe(true);
    expect(magalu.url).toContain('magazinevoce.com.br/radarsmartloja/');
    expect(ml.monetized).toBe(true);
    expect(ml.url).toBe('https://mercadolivre.com/sec/1AbCdEf');
    expect(shopee.monetized).toBe(true);
    expect(shopee.url).toContain('af_siteid=998877');
  });

  it('gera cabeçalho SHA256 exato conforme especificação oficial da Shopee Open API', () => {
    const payload = '{"query":"{ productOfferV2 { nodes { itemId } } }"}';
    const { header, signature } = buildShopeeAuthHeader({
      appId: '12345',
      secret: 'MY_SECRET',
      payload,
      timestampSec: 1700000000,
    });

    const expectedSig = crypto
      .createHash('sha256')
      .update(`123451700000000${payload}MY_SECRET`, 'utf8')
      .digest('hex');

    expect(signature).toBe(expectedSig);
    expect(header).toBe(`SHA256 Credential=12345, Timestamp=1700000000, Signature=${expectedSig}`);
  });
});
