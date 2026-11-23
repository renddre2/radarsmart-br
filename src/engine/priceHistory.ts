import type {
  NormalizedOffer,
  PriceHistoryMap,
  PriceHistoryRecord,
} from '@/types/domain';

const MAX_HISTORY_POINTS_PER_MODEL = 45;
const MAX_EXPIRED_ARCHIVE = 60;

/**
 * Updates price history records and protects users against inflated "metade do dobro" list prices.
 */
export function evaluateAndRecordPriceHistory(
  offers: NormalizedOffer[],
  previousHistory: PriceHistoryMap,
  nowIso: string,
): { offers: NormalizedOffer[]; nextHistory: PriceHistoryMap } {
  const nextRecords: Record<string, PriceHistoryRecord> = {
    ...previousHistory.records,
  };

  const dayKey = nowIso.slice(0, 10);

  const enriched = offers.map((offer) => {
    const existing = nextRecords[offer.canonicalKey];
    const points = existing ? [...existing.points] : [];

    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint.date !== dayKey || lastPoint.price !== offer.effectivePrice) {
      points.push({
        date: dayKey,
        price: offer.effectivePrice,
        listPrice: offer.listPrice,
        storeKey: offer.storeKey,
      });
    }

    const trimmedPoints = points.slice(-MAX_HISTORY_POINTS_PER_MODEL);
    const prices = trimmedPoints.map((p) => p.price);
    const minObservedPrice = Math.min(...prices, offer.effectivePrice);
    const maxObservedPrice = Math.max(...prices, offer.effectivePrice);
    const avgObservedPrice = Number(
      (prices.reduce((acc, p) => acc + p, 0) / prices.length).toFixed(2),
    );

    // Anti-"metade do dobro": if listPrice is > 1.75x effectivePrice AND never observed >= 85% of listPrice
    const suspiciousListPrice =
      offer.listPrice > offer.effectivePrice * 1.75 &&
      maxObservedPrice < offer.listPrice * 0.85;

    const trustworthyReference = suspiciousListPrice
      ? Math.max(avgObservedPrice, offer.effectivePrice)
      : Math.max(offer.listPrice, avgObservedPrice);

    const verifiedDiscountPct =
      trustworthyReference > offer.effectivePrice
        ? Math.min(60, Math.round(((trustworthyReference - offer.effectivePrice) / trustworthyReference) * 100))
        : 0;

    let priceAlertLabel = 'Preço em linha com o varejo';
    if (suspiciousListPrice) {
      priceAlertLabel = 'Preço de tabela inflado filtrado (desconto real recalculado)';
    } else if (trimmedPoints.length >= 2 && offer.effectivePrice <= minObservedPrice) {
      priceAlertLabel = 'Menor preço observado no histórico';
    } else if (verifiedDiscountPct >= 18) {
      priceAlertLabel = `Desconto verificado de ${verifiedDiscountPct}%`;
    } else if (offer.effectivePrice < avgObservedPrice * 0.94) {
      priceAlertLabel = 'Abaixo da média observada';
    }

    nextRecords[offer.canonicalKey] = {
      canonicalKey: offer.canonicalKey,
      canonicalModel: offer.specs.canonicalModel,
      minObservedPrice,
      maxObservedPrice,
      avgObservedPrice,
      observationsCount: (existing?.observationsCount ?? 0) + 1,
      lastObservedAt: nowIso,
      points: trimmedPoints,
    };

    return {
      ...offer,
      discountPct: verifiedDiscountPct,
      priceStats: {
        minObservedPrice,
        maxObservedPrice,
        avgObservedPrice,
        observationsCount: nextRecords[offer.canonicalKey].observationsCount,
        suspiciousListPrice,
        verifiedDiscountPct,
        priceAlertLabel,
      },
    };
  });

  return {
    offers: enriched,
    nextHistory: {
      updatedAt: nowIso,
      records: nextRecords,
    },
  };
}

/**
 * Transitions previously active offers that are no longer in stock to `expired`,
 * linking each one to the best active replacement of the same canonical model or price band.
 */
export function reconcileExpiredOffers(
  previousActive: NormalizedOffer[],
  currentActive: NormalizedOffer[],
  previousExpired: NormalizedOffer[],
  nowIso: string,
): { expiredOffers: NormalizedOffer[]; newlyAddedCount: number } {
  const currentIds = new Set(currentActive.map((o) => o.id));
  const previousIds = new Set(previousActive.map((o) => o.id));

  const newlyAddedCount = currentActive.filter((o) => !previousIds.has(o.id)).length;

  const findReplacement = (oldOffer: NormalizedOffer): NormalizedOffer | undefined => {
    const sameModel = currentActive
      .filter((c) => c.canonicalKey === oldOffer.canonicalKey)
      .sort((a, b) => a.effectivePrice - b.effectivePrice);
    if (sameModel[0]) return sameModel[0];

    const sameBrandBand = currentActive
      .filter((c) => c.brand === oldOffer.brand && c.condition === oldOffer.condition)
      .sort((a, b) => Math.abs(a.effectivePrice - oldOffer.effectivePrice) - Math.abs(b.effectivePrice - oldOffer.effectivePrice));
    return sameBrandBand[0] ?? currentActive[0];
  };

  const newlyExpired = previousActive
    .filter((prev) => !currentIds.has(prev.id))
    .map((prev) => {
      const replacement = findReplacement(prev);
      return {
        ...prev,
        status: 'expired' as const,
        availableQuantity: 0,
        expiredAt: nowIso,
        replacementOfferId: replacement?.id,
        replacementSlug: replacement?.slug,
      };
    });

  // Remove any previously expired offer that came back in stock
  const retainedExpired = previousExpired
    .filter((exp) => !currentIds.has(exp.id))
    .map((exp) => {
      const replacement = findReplacement(exp);
      return {
        ...exp,
        status: 'expired' as const,
        replacementOfferId: replacement?.id,
        replacementSlug: replacement?.slug,
      };
    });

  const merged = new Map<string, NormalizedOffer>();
  for (const item of [...newlyExpired, ...retainedExpired]) {
    merged.set(item.id, item);
  }

  return {
    expiredOffers: Array.from(merged.values()).slice(0, MAX_EXPIRED_ARCHIVE),
    newlyAddedCount,
  };
}
