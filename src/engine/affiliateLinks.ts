import type { AffiliateStatusItem, NormalizedOffer, StoreComparisonLink } from '@/types/domain';
import affiliateConfig from '../../config/affiliate-public.json';

export interface AffiliateEnvConfig {
  magaluStoreSlug: string;
  amazonPartnerTag: string;
  shopeeAffiliateId: string;
  shopeeAppId: string;
  shopeeAppSecret: string;
  awinAffiliateId: string;
  awinMidMotorola: string;
  awinMidFastshop: string;
  awinMidTrocafone: string;
  awinMidKabum: string;
  lomadeeSourceId: string;
  mlAffiliateMap: Record<string, string>;
}

export function readAffiliateEnv(
  env: Record<string, string | undefined> = process.env,
): AffiliateEnvConfig {
  let mlAffiliateMap: Record<string, string> = {};
  const rawMap = (env.ML_AFFILIATE_MAP_JSON ?? '').trim();
  if (rawMap.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMap) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        mlAffiliateMap = parsed;
      }
    } catch {
      mlAffiliateMap = {};
    }
  }

  return {
    magaluStoreSlug: (env.MAGALU_STORE_SLUG ?? '').trim(),
    amazonPartnerTag: (env.AMAZON_PARTNER_TAG ?? '').trim(),
    shopeeAffiliateId: (env.SHOPEE_AFFILIATE_ID ?? '').trim(),
    shopeeAppId: (env.SHOPEE_APP_ID ?? '').trim(),
    shopeeAppSecret: (env.SHOPEE_APP_SECRET ?? '').trim(),
    awinAffiliateId: (env.AWIN_AFFILIATE_ID ?? '').trim(),
    awinMidMotorola: (env.AWIN_MID_MOTOROLA ?? '').trim(),
    awinMidFastshop: (env.AWIN_MID_FASTSHOP ?? '').trim(),
    awinMidTrocafone: (env.AWIN_MID_TROCAFONE ?? '').trim(),
    awinMidKabum: (env.AWIN_MID_KABUM ?? '').trim(),
    lomadeeSourceId: (env.LOMADEE_SOURCE_ID ?? '').trim(),
    mlAffiliateMap,
  };
}

export function wrapAwinDeepLink(awinAffId: string, merchantId: string, targetUrl: string): string {
  return `https://www.awin1.com/cread.php?awinmid=${encodeURIComponent(merchantId)}&awinaffid=${encodeURIComponent(awinAffId)}&ued=${encodeURIComponent(targetUrl)}`;
}

export function wrapLomadeeDeepLink(sourceId: string, targetUrl: string): string {
  return `https://redir.lomadee.com/v2/deeplink?sourceId=${encodeURIComponent(sourceId)}&url=${encodeURIComponent(targetUrl)}`;
}

export function buildSearchQueryForOffer(offer: NormalizedOffer): string {
  const storage = offer.specs.storageGb ? `${offer.specs.storageGb}GB` : '';
  return `${offer.specs.canonicalModel} ${storage}`.replace(/\s+/g, ' ').trim();
}

export function attachAffiliateLinks(
  offer: NormalizedOffer,
  cfg: AffiliateEnvConfig = readAffiliateEnv(),
): NormalizedOffer {
  const query = buildSearchQueryForOffer(offer);
  const encodedQuery = encodeURIComponent(query);

  // 1. Direct monetization on the source store itself (Awin / Shopee / Lomadee)
  let monetizedUrl = offer.originalUrl;
  let monetizedProgram = 'direto-sem-tag';
  let isDirectlyMonetized = false;

  if (offer.storeKey === 'shopee' && offer.originalUrl.includes('shope')) {
    monetizedProgram = cfg.shopeeAppId ? 'shopee-open-api' : 'shopee-direto';
    isDirectlyMonetized = Boolean(cfg.shopeeAppId || cfg.shopeeAffiliateId);
  } else if (cfg.awinAffiliateId) {
    const midMap: Partial<Record<NormalizedOffer['storeKey'], string>> = {
      motorola: cfg.awinMidMotorola,
      fastshop: cfg.awinMidFastshop,
      trocafone: cfg.awinMidTrocafone,
    };
    const mid = midMap[offer.storeKey];
    if (mid) {
      monetizedUrl = wrapAwinDeepLink(cfg.awinAffiliateId, mid, offer.originalUrl);
      monetizedProgram = `awin-mid-${mid}`;
      isDirectlyMonetized = true;
    }
  } else if (cfg.lomadeeSourceId) {
    monetizedUrl = wrapLomadeeDeepLink(cfg.lomadeeSourceId, offer.originalUrl);
    monetizedProgram = 'lomadee';
    isDirectlyMonetized = true;
  }

  // 2. Multi-store comparison matrix (monetizable via CPF on Amazon, Magalu, ML, Shopee, KaBuM!/Awin)
  const amazonUrl = cfg.amazonPartnerTag
    ? `https://www.amazon.com.br/s?k=${encodedQuery}&tag=${encodeURIComponent(cfg.amazonPartnerTag)}`
    : `https://www.amazon.com.br/s?k=${encodedQuery}`;

  const magaluUrl = cfg.magaluStoreSlug
    ? `https://www.magazinevoce.com.br/${encodeURIComponent(cfg.magaluStoreSlug)}/busca/${encodedQuery}/`
    : `https://www.magazineluiza.com.br/busca/${encodedQuery}/`;

  const mlMappedUrl =
    cfg.mlAffiliateMap[offer.canonicalKey] ??
    cfg.mlAffiliateMap[offer.slug] ??
    `https://lista.mercadolivre.com.br/${encodeURIComponent(query.replace(/\s+/g, '-').toLowerCase())}`;
  const mlMonetized = Boolean(cfg.mlAffiliateMap[offer.canonicalKey] || cfg.mlAffiliateMap[offer.slug]);

  const shopeeSearchBase = `https://shopee.com.br/search?keyword=${encodedQuery}`;
  const shopeeUrl = cfg.shopeeAffiliateId
    ? `${shopeeSearchBase}&af_siteid=${encodeURIComponent(cfg.shopeeAffiliateId)}`
    : shopeeSearchBase;

  const kabumBase = `https://www.kabum.com.br/busca/${encodeURIComponent(query.replace(/\s+/g, '-').toLowerCase())}`;
  const kabumUrl =
    cfg.awinAffiliateId && cfg.awinMidKabum
      ? wrapAwinDeepLink(cfg.awinAffiliateId, cfg.awinMidKabum, kabumBase)
      : kabumBase;

  const comparisonLinks: StoreComparisonLink[] = [
    {
      storeId: offer.storeKey,
      storeLabel: `${offer.storeName} (Oferta Verificada)`,
      program: monetizedProgram,
      url: monetizedUrl,
      monetized: isDirectlyMonetized,
      estimatedCommissionPct: offer.storeKey === 'trocafone' ? '4%–8%' : '2%–5%',
      note: `Preço auditado: R$ ${offer.effectivePrice.toFixed(2).replace('.', ',')}`,
    },
    {
      storeId: 'amazon',
      storeLabel: 'Amazon Brasil',
      program: cfg.amazonPartnerTag ? 'amazon-associados' : 'busca-direta',
      url: amazonUrl,
      monetized: Boolean(cfg.amazonPartnerTag),
      estimatedCommissionPct: '1%–3%',
      note: 'Comparar preço e entrega Prime',
    },
    {
      storeId: 'magalu',
      storeLabel: 'Magalu (Parceiro)',
      program: cfg.magaluStoreSlug ? 'influenciador-magalu' : 'busca-direta',
      url: magaluUrl,
      monetized: Boolean(cfg.magaluStoreSlug),
      estimatedCommissionPct: '4%–6%',
      note: 'Retira na loja / garantia nacional',
    },
    {
      storeId: 'mercadolivre',
      storeLabel: 'Mercado Livre',
      program: mlMonetized ? 'ml-afiliados-sec' : 'busca-direta',
      url: mlMappedUrl,
      monetized: mlMonetized,
      estimatedCommissionPct: '2%–4%',
      note: 'Entrega Full em capitais',
    },
    {
      storeId: 'shopee',
      storeLabel: 'Shopee Lojas Oficiais',
      program: cfg.shopeeAffiliateId || cfg.shopeeAppId ? 'shopee-afiliados' : 'busca-direta',
      url: shopeeUrl,
      monetized: Boolean(cfg.shopeeAffiliateId || cfg.shopeeAppId),
      estimatedCommissionPct: '2%–10%',
      note: 'Cupons de plataforma e lojas oficiais',
    },
    {
      storeId: 'kabum',
      storeLabel: 'KaBuM! (via Awin)',
      program: cfg.awinAffiliateId && cfg.awinMidKabum ? 'awin-kabum' : 'busca-direta',
      url: kabumUrl,
      monetized: Boolean(cfg.awinAffiliateId && cfg.awinMidKabum),
      estimatedCommissionPct: '2%–4%',
      note: 'Desconto no Pix em hardware/smartphones',
    },
  ];

  return {
    ...offer,
    monetizedUrl,
    monetizedProgram,
    isDirectlyMonetized,
    comparisonLinks,
  };
}

export function getAffiliateProgramsStatus(cfg: AffiliateEnvConfig = readAffiliateEnv()): AffiliateStatusItem[] {
  const { programs } = affiliateConfig;
  const configuredMap: Record<string, boolean> = {
    magalu: Boolean(cfg.magaluStoreSlug),
    mercadolivre: Object.keys(cfg.mlAffiliateMap).length > 0,
    amazon: Boolean(cfg.amazonPartnerTag),
    shopee: Boolean(cfg.shopeeAppId && cfg.shopeeAppSecret) || Boolean(cfg.shopeeAffiliateId),
    awin: Boolean(cfg.awinAffiliateId),
    lomadee: Boolean(cfg.lomadeeSourceId),
  };

  return Object.entries(programs).map(([id, meta]) => ({
    id,
    label: meta.label,
    configured: Boolean(configuredMap[id]),
    acceptsCpf: meta.acceptsCpf,
    commissionRange: meta.commissionRange,
    minPayoutBrl: meta.minPayoutBrl,
    envVar: meta.envVar,
    signupUrl: meta.signupUrl,
  }));
}
