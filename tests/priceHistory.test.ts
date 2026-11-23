import { describe, expect, it } from 'vitest';
import type { PriceHistoryMap } from '@/types/domain';
import { normalizeRawItem } from '@/engine/normalizer';
import { evaluateAndRecordPriceHistory, reconcileExpiredOffers } from '@/engine/priceHistory';

describe('Price History, Anti-"Metade do Dobro" & Expired Lifecycle', () => {
  it('detecta listPrice inflado artificialmente e filtra falso desconto', () => {
    const offer = normalizeRawItem({
      storeKey: 'fastshop',
      storeName: 'Fast Shop',
      productId: '999',
      skuId: '1',
      title: 'Smartphone Samsung Galaxy A56 5G 256GB 8GB RAM',
      brand: 'Samsung',
      categories: ['/Celulares/'],
      price: 1999,
      listPrice: 4999, // > 2.5x without history
      availableQuantity: 10,
      imageUrl: 'https://site.fastshop.com.br/img.jpg',
      productUrl: 'https://site.fastshop.com.br/galaxy-a56/p',
      observedAt: '2026-11-23T20:00:00Z',
    })!;

    const emptyHistory: PriceHistoryMap = { updatedAt: '', records: {} };
    const { offers } = evaluateAndRecordPriceHistory([offer], emptyHistory, '2026-11-23T20:00:00Z');
    expect(offers[0].priceStats.suspiciousListPrice).toBe(true);
    expect(offers[0].priceStats.verifiedDiscountPct).toBe(0);
    expect(offers[0].priceStats.priceAlertLabel).toContain('filtrado');
  });

  it('marca oferta que sumiu do estoque como expired e vincula substituto ativo', () => {
    const oldOffer = normalizeRawItem({
      storeKey: 'bemol',
      storeName: 'Bemol',
      productId: '10',
      skuId: '10',
      title: 'Smartphone Samsung Galaxy A27 5G 256GB',
      brand: 'Samsung',
      categories: ['/Celulares/'],
      price: 1899,
      listPrice: 2199,
      availableQuantity: 4,
      imageUrl: 'https://www.bemol.com.br/a27.jpg',
      productUrl: 'https://www.bemol.com.br/a27/p',
      observedAt: '2026-11-22T20:00:00Z',
    })!;

    const newReplacement = normalizeRawItem({
      storeKey: 'fastshop',
      storeName: 'Fast Shop',
      productId: '11',
      skuId: '11',
      title: 'Smartphone Samsung Galaxy A27 5G 256GB Preto',
      brand: 'Samsung',
      categories: ['/Celulares/'],
      price: 1849,
      listPrice: 2199,
      availableQuantity: 12,
      imageUrl: 'https://site.fastshop.com.br/a27.jpg',
      productUrl: 'https://site.fastshop.com.br/a27/p',
      observedAt: '2026-11-23T20:00:00Z',
    })!;

    const { expiredOffers, newlyAddedCount } = reconcileExpiredOffers(
      [oldOffer],
      [newReplacement],
      [],
      '2026-11-23T20:00:00Z',
    );

    expect(newlyAddedCount).toBe(1);
    expect(expiredOffers).toHaveLength(1);
    expect(expiredOffers[0].status).toBe('expired');
    expect(expiredOffers[0].replacementOfferId).toBe(newReplacement.id);
    expect(expiredOffers[0].replacementSlug).toBe(newReplacement.slug);
  });
});
