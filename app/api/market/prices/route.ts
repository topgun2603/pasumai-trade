import { unitLabel } from "@/lib/domain/enums";
import { freshness, type StockOffer } from "@/lib/domain/market";
import { formatMoney, money } from "@/lib/domain/money";
import { marketHigh, marketLow, produceName } from "@/lib/domain/models";
import { openListings } from "@/lib/mock/listings";
import { stockOffers } from "@/lib/mock/market";

/**
 * Indicative prices for the public landing page.
 *
 * Deliberately not the full catalogue: the cheapest currently-available line
 * per crop, with the published mandi range beside it where one exists. No
 * seller, no collection point, no quantity — those are for signed-in buyers.
 *
 * Route handlers are uncached by default in Next 16, which is what we want.
 * Produce prices move through the day and a stale rate on the front page is
 * worse than no rate at all.
 */

export interface PriceLine {
  readonly id: string;
  readonly nameEn: string;
  readonly nameTa: string;
  readonly emoji: string;
  readonly unit: string;
  readonly price: string;
  readonly mandiRange: string | null;
  /** How many villages this crop can currently be collected from. */
  readonly sources: number;
  readonly freshness: "fresh" | "useSoon" | "endOfLife";
}

function bestPerProduce(offers: StockOffer[]): Map<string, StockOffer[]> {
  const grouped = new Map<string, StockOffer[]>();
  for (const offer of offers) {
    const existing = grouped.get(offer.sku.produce.id) ?? [];
    existing.push(offer);
    grouped.set(offer.sku.produce.id, existing);
  }
  return grouped;
}

export async function GET() {
  const now = new Date();
  const t = now.getTime();

  // Mandi references live on listings, keyed by crop. Absent for a crop that
  // nobody has listed today — shown as unavailable rather than guessed at.
  const mandi = new Map(
    openListings(now).map((l) => [l.produce.id, l.marketRate]),
  );

  const lines: PriceLine[] = [...bestPerProduce(stockOffers(now)).entries()]
    .map(([produceId, offers]) => {
      const cheapest = offers.reduce((best, offer) =>
        offer.pricePerUnit < best.pricePerUnit ? offer : best,
      );
      const rate = mandi.get(produceId);

      return {
        id: produceId,
        nameEn: cheapest.sku.produce.names.en,
        nameTa: produceName(cheapest.sku.produce, "ta"),
        emoji: cheapest.sku.produce.emoji,
        unit: unitLabel(cheapest.sku.unit),
        price: formatMoney(money(cheapest.pricePerUnit)),
        mandiRange: rate
          ? `${formatMoney(marketLow(rate))} – ${formatMoney(marketHigh(rate))}`
          : null,
        // Distinct villages the crop can be collected from.
        sources: new Set(offers.map((o) => o.placeId)).size,
        freshness: freshness(cheapest, t),
      };
    })
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn, "en-IN"));

  return Response.json({
    asOf: now.toISOString(),
    lines,
  });
}
