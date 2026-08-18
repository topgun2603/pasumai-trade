import { QUANTITY_UNITS, unitLabel, type QuantityUnit } from "@/lib/domain/enums";
import { freshness, type StockOffer } from "@/lib/domain/market";
import { formatMoney, money } from "@/lib/domain/money";
import { produceName, type Produce } from "@/lib/domain/models";
import {
  preferLive,
  quotesFrom,
  type PriceQuote,
} from "@/lib/domain/todays-price";
import { readSettledSales } from "@/lib/firebase/settled-price-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { stockOffers } from "@/lib/mock/market";

/**
 * Today's prices for the public landing page.
 *
 * **Real bargains first.** Every figure here used to come from seeded sample
 * stock while the copy above it said "what farmers and buyers agreed on today"
 * — a claim the page could not support, because nobody had agreed anything
 * behind those numbers. Now the settled bargains of the last day are asked for
 * first, and the sample is kept only to fill the gaps, marked as an
 * illustration on each card it fills.
 *
 * Marked per line rather than per page, because the honest state is normally
 * mixed: tomato settled four times today and turmeric has not traded this week.
 * "Some of these are examples" leaves the reader to work out which, and the one
 * they guess wrong about is the one they act on.
 *
 * Deliberately not the full catalogue, and no seller, village or quantity —
 * those are for signed-in buyers.
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
  /**
   * A sample rather than a bargain anybody struck.
   *
   * The card says so in as many words. A price that looks identical whether or
   * not it is real is the one thing this section must never produce.
   */
  readonly illustrative: boolean;
}

/** How many cards the section shows. */
const TARGET = 9;

function bestPerProduce(offers: StockOffer[]): Map<string, StockOffer[]> {
  const grouped = new Map<string, StockOffer[]>();
  for (const offer of offers) {
    const existing = grouped.get(offer.sku.produce.id) ?? [];
    existing.push(offer);
    grouped.set(offer.sku.produce.id, existing);
  }
  return grouped;
}

/** The seeded stock, expressed as the same kind of quote a real sale gives. */
function templateQuotes(now: Date): Array<{ quote: PriceQuote; offer: StockOffer }> {
  return [...bestPerProduce(stockOffers(now)).entries()]
    .map(([produceId, offers]) => {
      const cheapest = offers.reduce((best, offer) =>
        offer.pricePerUnit < best.pricePerUnit ? offer : best,
      );

      return {
        offer: cheapest,
        quote: {
          produceId,
          ratePerUnit: cheapest.pricePerUnit,
          unit: unitLabel(cheapest.sku.unit),
          settledCount: offers.length,
          sources: new Set(offers.map((o) => o.placeId)).size,
          latestAt: now,
        },
      };
    })
    .sort((a, b) =>
      a.offer.sku.produce.names.en.localeCompare(b.offer.sku.produce.names.en, "en-IN"),
    );
}

const CROPS: Produce[] = Object.values(CATALOGUE);

/**
 * A settled bargain stores the unit code; the sample stores the label.
 *
 * Identical strings in English today, which is exactly why this is worth
 * doing now: the day somebody writes "crate (20 kg)" into the labels, live
 * lines would go on rendering the bare code beside samples that do not, and
 * the two halves of one grid would quietly stop matching.
 */
function labelFor(unit: string): string {
  return unit in QUANTITY_UNITS ? unitLabel(unit as QuantityUnit) : unit;
}

function cropById(id: string): Produce | undefined {
  return CROPS.find((crop) => crop.id === id);
}

/**
 * Shelf life measured from the agreement.
 *
 * A settled bargain records no best-before date — the badge on a sample comes
 * from the seeded lot's own. Grading happens at collection, within a day or so
 * of the handshake, so the crop's shelf life counted from the agreement is the
 * closest honest estimate available. Crops with no shelf life recorded are
 * treated as keeping well, which is what the platform default already assumes.
 */
function freshnessFromSale(crop: Produce | undefined, agreedAt: Date, now: number) {
  const hours = crop?.shelfLifeHours ?? 24 * 30;
  const left = (agreedAt.getTime() + hours * 3_600_000 - now) / 3_600_000;
  if (left <= 24) return "endOfLife" as const;
  if (left <= 60) return "useSoon" as const;
  return "fresh" as const;
}

export async function GET() {
  const now = new Date();
  const t = now.getTime();

  const byEnglishName = new Map(CROPS.map((crop) => [crop.names.en, crop.id]));
  const { sales } = await readSettledSales((name) => byEnglishName.get(name), now);

  const live = quotesFrom(sales, t);
  const template = templateQuotes(now);
  const offerFor = new Map(template.map((entry) => [entry.quote.produceId, entry.offer]));

  const lines: PriceLine[] = preferLive(
    live,
    template.map((entry) => entry.quote),
    TARGET,
  ).flatMap(({ quote, illustrative }): PriceLine[] => {
    const crop = cropById(quote.produceId);
    if (!crop) return [];

    const offer = offerFor.get(quote.produceId);

    return [
      {
        id: quote.produceId,
        nameEn: crop.names.en,
        nameTa: produceName(crop, "ta"),
        emoji: crop.emoji,
        unit: labelFor(quote.unit),
        price: formatMoney(money(quote.ratePerUnit)),
        // How many separate bargains settled on this crop. The price is
        // whatever farmers and buyers agreed, so the useful context is how
        // many independent agreements stand behind it — not an external index.
        settledCount: quote.settledCount,
        sources: quote.sources,
        freshness:
          illustrative && offer
            ? freshness(offer, t)
            : freshnessFromSale(crop, quote.latestAt, t),
        illustrative,
      },
    ];
  });

  // Real figures first, then the illustrations, each half alphabetical. A
  // farmer scanning the section reaches every real price before any example.
  lines.sort(
    (a, b) =>
      Number(a.illustrative) - Number(b.illustrative) ||
      a.nameEn.localeCompare(b.nameEn, "en-IN"),
  );

  return Response.json({
    asOf: now.toISOString(),
    /** How many of these are real, so the section can say so once at the top. */
    liveCount: lines.filter((line) => !line.illustrative).length,
    lines,
  });
}
