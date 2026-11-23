import { describe, expect, it } from 'vitest';
import type { PublishedLedgerEntry, SocialPostAsset } from '@/types/domain';
import { normalizeRawItem } from '@/engine/normalizer';
import { scoreOffer } from '@/engine/scorer';
import { passesFactGuard } from '@/engine/contentGenerator';
import { selectPostsToPublish } from '@/engine/publisher';
import { parseVtexProducts, VTEX_SOURCES } from '@/engine/collectors/vtexCollector';

describe('Publisher Deduplication, Fact-Guard & Source Resilience', () => {
  const offer = scoreOffer(
    normalizeRawItem({
      storeKey: 'fastshop',
      storeName: 'Fast Shop',
      productId: '777',
      skuId: '7771',
      title: 'Smartphone Samsung Galaxy A56 5G 256GB 8GB RAM',
      brand: 'Samsung',
      categories: ['/Celulares/'],
      price: 1899.0,
      listPrice: 2799.0,
      availableQuantity: 20,
      imageUrl: 'https://site.fastshop.com.br/a56.jpg',
      productUrl: 'https://site.fastshop.com.br/a56/p',
      observedAt: '2026-11-23T20:00:00Z',
    })!,
  );

  it('Fact-Guard bloqueia copy com preço alucinado pelo LLM e aceita preço exato', () => {
    expect(passesFactGuard('Oferta verificada do Galaxy A56 256GB por R$ 1.899,00 na Fast Shop!', offer)).toBe(true);
    expect(passesFactGuard('Imperdível Galaxy A56 saindo por apenas R$ 999,00 hoje!', offer)).toBe(false);
    expect(passesFactGuard('Curto', offer)).toBe(false);
  });

  it('evita republicação duplicada dentro de 72h salvo se preço cair >= 8%', () => {
    const candidate: SocialPostAsset = {
      offerId: offer.id,
      slug: offer.slug,
      title: offer.title,
      opportunityScore: 85,
      price: 1899,
      storeName: offer.storeName,
      telegramHtml: '<b>ok</b>',
      whatsappText: 'ok',
      shortVideoScript: 'ok',
      instagramCaption: 'ok',
      generatedBy: 'deterministic',
    };

    const ledgerRecentSamePrice: PublishedLedgerEntry[] = [
      {
        offerId: offer.id,
        canonicalKey: offer.slug,
        channel: 'telegram',
        publishedPrice: 1899,
        publishedAt: '2026-11-23T15:00:00Z',
        status: 'sent',
      },
    ];

    const blocked = selectPostsToPublish(
      [candidate],
      ledgerRecentSamePrice,
      new Date('2026-11-23T20:00:00Z').getTime(),
    );
    expect(blocked).toHaveLength(0);

    // Price dropped 12% -> allow repost
    const priceDropPost = { ...candidate, price: 1650 };
    const allowed = selectPostsToPublish(
      [priceDropPost],
      ledgerRecentSamePrice,
      new Date('2026-11-23T20:00:00Z').getTime(),
    );
    expect(allowed).toHaveLength(1);
  });

  it('parseVtexProducts isola itens inválidos sem derrubar ofertas válidas no mesmo payload', () => {
    const source = VTEX_SOURCES[1]; // fastshop
    const { rawItems, rejectedCount } = parseVtexProducts(
      source,
      [
        {
          productId: '1',
          productName: 'Película Vidro iPhone 16',
          categories: ['/Acessórios/'],
          link: '/pelicula/p',
          items: [{ itemId: '1', sellers: [{ commertialOffer: { Price: 49, ListPrice: 59, AvailableQuantity: 10 } }] }],
        },
        {
          productId: '2',
          productName: 'Smartphone Samsung Galaxy A27 8GB 256GB Preto',
          brand: 'Samsung',
          categories: ['/Celular e Smartphone/'],
          link: '/galaxy-a27/p',
          items: [
            {
              itemId: '2',
              images: [{ imageUrl: 'https://site.fastshop.com.br/a27.jpg' }],
              sellers: [{ commertialOffer: { Price: 1999, ListPrice: 2499, AvailableQuantity: 5 } }],
            },
          ],
        },
      ],
      '2026-11-23T20:00:00Z',
    );

    expect(rejectedCount).toBe(1);
    expect(rawItems).toHaveLength(1);
    expect(rawItems[0].title).toContain('Galaxy A27');
  });
});
