import type { NormalizedOffer, StrategyWeights } from '@/types/domain';
import { VTEX_SOURCES } from './collectors/vtexCollector';

const DEFAULT_WEIGHTS: StrategyWeights = {
  updatedAt: new Date().toISOString(),
  brandMultipliers: {},
  priceBandMultipliers: {
    'ate-1200': 1.1,
    '1200-2200': 1.15,
    '2200-4000': 1.05,
    'acima-4000': 0.96,
  },
  storeMultipliers: {},
  notes: 'Fallback default weights',
};

export function scoreOffer(
  offer: NormalizedOffer,
  weights: StrategyWeights = DEFAULT_WEIGHTS,
): NormalizedOffer {
  // 1. Technical Score (0-35), adjusted gently by price-to-spec value
  let valueRatioBoost = 0;
  const perfPerThousandBrl = (offer.specs.baseTechnicalScore / Math.max(offer.effectivePrice, 450)) * 1000;
  if (perfPerThousandBrl >= 14) valueRatioBoost = 4;
  else if (perfPerThousandBrl >= 10) valueRatioBoost = 2;
  const technical = Math.min(35, Math.max(10, offer.specs.baseTechnicalScore + valueRatioBoost));

  // 2. Real Verified Discount Score (0-30)
  const verifiedPct = offer.priceStats.verifiedDiscountPct;
  const isAtHistoricalLow =
    offer.priceStats.observationsCount >= 2 &&
    offer.effectivePrice <= offer.priceStats.minObservedPrice;
  const discountRaw = Math.min(25, Math.round(verifiedPct * 0.9)) + (isAtHistoricalLow ? 5 : 0);
  const discount = Math.min(30, Math.max(0, discountRaw));

  // 3. Trust & Warranty Score (0-20)
  const sourceTrust = VTEX_SOURCES.find((s) => s.storeKey === offer.storeKey)?.trustScore ?? 16;
  const trust = offer.condition === 'recondicionado' ? Math.min(16, sourceTrust) : sourceTrust;

  // 4. Commercial Conversion Potential Score (0-15) modulated by learned strategy weights
  const brandMult = weights.brandMultipliers[offer.brand] ?? 1.0;
  const bandMult = weights.priceBandMultipliers[offer.priceBand] ?? 1.0;
  const storeMult = weights.storeMultipliers[offer.storeKey] ?? 1.0;
  const monetizationBonus = offer.isDirectlyMonetized ? 2 : 0;

  const baseCommercial = 10 + (offer.specs.has5g ? 1 : 0) + (offer.specs.hasNfc ? 1 : 0) + monetizationBonus;
  const commercial = Math.min(15, Math.max(4, Math.round(baseCommercial * ((brandMult + bandMult + storeMult) / 3))));

  const opportunityScore = Math.min(100, Math.max(15, technical + discount + trust + commercial));

  return {
    ...offer,
    opportunityScore,
    scoreBreakdown: {
      technical,
      discount,
      trust,
      commercial,
    },
  };
}
