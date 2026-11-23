import { describe, expect, it } from 'vitest';
import type { RawStoreItem } from '@/types/domain';
import {
  deduplicateOffers,
  isValidSmartphoneOffer,
  normalizeRawItem,
} from '@/engine/normalizer';

function makeRaw(overrides: Partial<RawStoreItem> = {}): RawStoreItem {
  return {
    storeKey: 'motorola',
    storeName: 'Motorola Oficial',
    productId: '501',
    skuId: '5011',
    title: 'Smartphone Motorola Moto G75 5G 256GB 8GB RAM',
    brand: 'Motorola',
    categories: ['/Smartphones/Moto G/'],
    price: 1599.0,
    listPrice: 1999.0,
    availableQuantity: 25,
    imageUrl: 'https://motorolabr.vtexassets.com/arquivos/ids/123/g75.jpg',
    productUrl: 'https://www.motorola.com.br/smartphone-moto-g75/p',
    observedAt: '2026-11-23T20:00:00Z',
    ...overrides,
  };
}

describe('Normalizer & Smartphone Guardrails', () => {
  it('rejeita películas, pneus, itens de teste e produtos fora de estoque', () => {
    const cases: RawStoreItem[] = [
      makeRaw({ title: 'Película De Privacidade Para iPhone 16 Pro', price: 499 }),
      makeRaw({ title: 'Pneu Aro 15 Galaxy 8.15-15 Yardmaster', price: 2199, brand: 'Galaxy' }),
      makeRaw({ title: 'TESTE PROD CAPA + PELICULA IPHONE', price: 99000 }),
      makeRaw({ title: 'Smartphone Samsung Galaxy A56 256GB', availableQuantity: 0 }),
      makeRaw({ title: 'Capa Silicone para Galaxy S25 Ultra', price: 59 }),
      makeRaw({ title: 'Smartphone Galaxy S25 Ultra 512GB', productUrl: 'http://invalido.local/p' }),
    ];

    for (const item of cases) {
      expect(isValidSmartphoneOffer(item).valid).toBe(false);
      expect(normalizeRawItem(item)).toBeNull();
    }
  });

  it('normaliza smartphone válido com specs, 5G, RAM e condição nova', () => {
    const offer = normalizeRawItem(makeRaw());
    expect(offer).not.toBeNull();
    expect(offer?.brand).toBe('Motorola');
    expect(offer?.condition).toBe('novo');
    expect(offer?.specs.storageGb).toBe(256);
    expect(offer?.specs.ramGb).toBe(8);
    expect(offer?.specs.has5g).toBe(true);
    expect(offer?.specs.hasNfc).toBe(true);
  });

  it('rotula Trocafone explicitamente como recondicionado e aplica Pix price quando menor', () => {
    const offer = normalizeRawItem(
      makeRaw({
        storeKey: 'trocafone',
        storeName: 'Trocafone (Recondicionado)',
        title: 'iPhone 15 128GB Preto - Muito Bom',
        brand: 'Apple',
        price: 3400,
        pixPrice: 3190,
        listPrice: 4200,
        productUrl: 'https://www.trocafone.com.br/iphone-15-128gb/p',
      }),
    );
    expect(offer?.condition).toBe('recondicionado');
    expect(offer?.effectivePrice).toBe(3190);
    expect(offer?.discountPct).toBe(24);
  });

  it('deduplica variantes de cor da mesma loja mantendo menor preço efetivo', () => {
    const black = normalizeRawItem(
      makeRaw({ productId: '1', skuId: '1', title: 'Smartphone Samsung Galaxy A56 256GB Preto', brand: 'Samsung', price: 2100 }),
    )!;
    const violet = normalizeRawItem(
      makeRaw({ productId: '2', skuId: '2', title: 'Smartphone Samsung Galaxy A56 256GB Violeta', brand: 'Samsung', price: 1899 }),
    )!;
    const deduped = deduplicateOffers([black, violet]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].effectivePrice).toBe(1899);
  });
});
