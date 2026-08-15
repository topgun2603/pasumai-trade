import { unitLabel } from "@/lib/domain/enums";
import { freshness, type StockOffer } from "@/lib/domain/market";
import { formatMoney, money } from "@/lib/domain/money";
import { produceName } from "@/lib/domain/models";
import { stockOffers } from "@/lib/mock/market";

/**
 * Indicative prices for the public landing page.
 *
 * Deliberately not the full catalogue: the cheapest currently-available line
 * per crop, and how many separate lots settled on it. No seller, no village,
 * no quantity — those are for signed-in buyers.
 *
 * Nothing here is benchmarked against an external index. The price on this
 * platform is whatever a farmer and a buyer agreed between themselves, so the
 * honest context is how many independent agreements stand behind the figure.
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
  /** Separate lots that settled on this crop today. */
  readonly settledCount: number;
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

  const lines: PriceLine[] = [...bestPerProduce(stockOffers(now)).entries()]
    .map(([produceId, offers]) => {
      const cheapest = offers.reduce((best, offer) =>
        offer.pricePerUnit < best.pricePerUnit ? offer : best,
      );

      return {
        id: produceId,
        nameEn: cheapest.sku.produce.names.en,
        nameTa: produceName(cheapest.sku.produce, "ta"),
        emoji: cheapest.sku.produce.emoji,
        unit: unitLabel(cheapest.sku.unit),
        price: formatMoney(money(cheapest.pricePerUnit)),
        // How many separate lots settled on this crop today. The price is
        // whatever farmers and buyers agreed, so the useful context is how
        // many independent agreements stand behind it — not an external index.
        settledCount: offers.length,
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
