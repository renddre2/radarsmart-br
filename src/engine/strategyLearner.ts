import type {
  NormalizedOffer,
  PerformanceFeedbackFile,
  PriceBand,
  StrategyWeights,
} from '@/types/domain';

function clampMultiplier(val: number): number {
  return Number(Math.max(0.75, Math.min(1.38, val)).toFixed(3));
}

export function recalibrateStrategyWeights(
  currentWeights: StrategyWeights,
  feedback: PerformanceFeedbackFile,
  activeOffers: NormalizedOffer[],
  nowIso: string = new Date().toISOString(),
): StrategyWeights {
  const brandMultipliers = { ...currentWeights.brandMultipliers };
  const priceBandMultipliers: Record<PriceBand, number> = { ...currentWeights.priceBandMultipliers };
  const storeMultipliers = { ...currentWeights.storeMultipliers };

  if (feedback.entries.length === 0) {
    // Organic supply signal when conversion telemetry is not yet populated:
    // Reward price bands and brands with stronger verified discounts & availability.
    const bandDiscounts = new Map<PriceBand, number[]>();
    for (const offer of activeOffers) {
      const arr = bandDiscounts.get(offer.priceBand) ?? [];
      arr.push(offer.priceStats.verifiedDiscountPct);
      bandDiscounts.set(offer.priceBand, arr);
    }
    for (const [band, discounts] of bandDiscounts.entries()) {
      const avg = discounts.reduce((a, b) => a + b, 0) / discounts.length;
      if (avg >= 12) {
        priceBandMultipliers[band] = clampMultiplier((priceBandMultipliers[band] ?? 1) + 0.02);
      }
    }
    return {
      updatedAt: nowIso,
      brandMultipliers,
      priceBandMultipliers,
      storeMultipliers,
      notes: 'Pesos calibrados com sinais de elasticidade do catálogo ativo (aguardando primeiras conversões registradas).',
    };
  }

  // Aggregate real clicks, conversions and commissions
  const brandStats = new Map<string, { clicks: number; conversions: number; commission: number }>();
  const bandStats = new Map<PriceBand, { clicks: number; conversions: number; commission: number }>();
  const storeStats = new Map<string, { clicks: number; conversions: number; commission: number }>();

  const accumulate = <K>(map: Map<K, { clicks: number; conversions: number; commission: number }>, key: K, entry: PerformanceFeedbackFile['entries'][number]) => {
    const cur = map.get(key) ?? { clicks: 0, conversions: 0, commission: 0 };
    cur.clicks += entry.clicks;
    cur.conversions += entry.conversions;
    cur.commission += entry.commissionBrl;
    map.set(key, cur);
  };

  for (const entry of feedback.entries) {
    accumulate(brandStats, entry.brand, entry);
    accumulate(bandStats, entry.priceBand, entry);
    accumulate(storeStats, entry.storeKey, entry);
  }

  const computeBoost = (stat: { clicks: number; conversions: number; commission: number }, current: number): number => {
    if (stat.clicks < 5) return current;
    const convRate = stat.conversions / Math.max(stat.clicks, 1);
    const delta = convRate >= 0.04 || stat.commission >= 50 ? 0.08 : convRate >= 0.015 ? 0.03 : -0.04;
    return clampMultiplier(current + delta);
  };

  for (const [brand, stat] of brandStats.entries()) {
    brandMultipliers[brand] = computeBoost(stat, brandMultipliers[brand] ?? 1.0);
  }
  for (const [band, stat] of bandStats.entries()) {
    priceBandMultipliers[band] = computeBoost(stat, priceBandMultipliers[band] ?? 1.0);
  }
  for (const [store, stat] of storeStats.entries()) {
    storeMultipliers[store] = computeBoost(stat, storeMultipliers[store] ?? 1.0);
  }

  return {
    updatedAt: nowIso,
    brandMultipliers,
    priceBandMultipliers,
    storeMultipliers,
    notes: `Aprendizado aplicado sobre ${feedback.entries.length} registros reais de cliques/conversões.`,
  };
}
