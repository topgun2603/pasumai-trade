import { GRADE_LABELS, type Grade } from "./enums";
import { freshness, type StockOffer } from "./market";
import { money, type Money } from "./money";
import { marketHigh, marketLow, produceName, type Listing } from "./models";

/**
 * Platform analytics.
 *
 * Every figure here is derived from data the platform already holds rather
 * than tracked separately, so nothing can drift out of agreement with the
 * operational screens. When Firestore lands these become aggregation queries
 * or a BigQuery view; the shapes are what the charts consume and should not
 * change.
 *
 * Series are returned in a fixed order. Chart colour is assigned by slot, so a
 * reordering here would silently repaint every chart.
 */

export interface SeriesPoint {
  readonly label: string;
  readonly value: number;
}

export interface TimePoint {
  /** Short label for the axis, e.g. `9 Aug`. */
  readonly label: string;
  readonly listings: number;
  readonly offers: number;
  readonly accepted: number;
}

export interface CropVolume {
  readonly crop: string;
  readonly kg: number;
  readonly value: number;
  /** Cheapest live price, in minor units per unit. */
  readonly price: number;
  readonly mandiLow: number;
  readonly mandiHigh: number;
  /** Percentage above or below the mandi midpoint. Negative is cheaper. */
  readonly vsMandi: number;
}

export interface GradeSplit {
  readonly grade: Grade;
  readonly label: string;
  readonly share: number;
}

export interface DistrictRow {
  readonly district: string;
  readonly listings: number;
  readonly farmers: number;
  readonly stockValue: number;
}

export interface FreshnessSplit {
  readonly fresh: number;
  readonly useSoon: number;
  readonly endOfLife: number;
  /** Value of stock inside 24 hours of shelf life. */
  readonly atRisk: Money;
}

/* ------------------------------------------------------------------------- */

/** Total value of everything currently on the shelf. */
export function stockValue(offers: readonly StockOffer[]): Money {
  return money(
    offers.reduce(
      (total, o) => total + Math.round(o.pricePerUnit * o.availableQuantity),
      0,
    ),
  );
}

/**
 * Value of stock that will be unsellable tomorrow.
 *
 * The most actionable number on the analytics page: it is the loss the
 * platform takes if nothing moves, and it is what discounting decisions are
 * made against.
 */
export function freshnessSplit(
  offers: readonly StockOffer[],
  now: number,
): FreshnessSplit {
  let fresh = 0;
  let useSoon = 0;
  let endOfLife = 0;
  let atRisk = 0;

  for (const offer of offers) {
    const state = freshness(offer, now);
    if (state === "fresh") fresh += 1;
    else if (state === "useSoon") useSoon += 1;
    else {
      endOfLife += 1;
      atRisk += Math.round(offer.pricePerUnit * offer.availableQuantity);
    }
  }

  return { fresh, useSoon, endOfLife, atRisk: money(atRisk) };
}

/**
 * Listing activity over the last `days` days.
 *
 * Buckets by day using the listing's own timestamp, so the series matches
 * what the listings table shows rather than being counted separately.
 */
export function activityOverTime(
  listings: readonly Listing[],
  now: Date,
  days = 14,
): TimePoint[] {
  const DAY = 86_400_000;
  const start = new Date(now.getTime() - (days - 1) * DAY);
  start.setHours(0, 0, 0, 0);

  const format = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  });

  const buckets: TimePoint[] = Array.from({ length: days }, (_, i) => ({
    label: format.format(new Date(start.getTime() + i * DAY)),
    listings: 0,
    offers: 0,
    accepted: 0,
  }));

  for (const listing of listings) {
    const index = Math.floor(
      (listing.createdAt.getTime() - start.getTime()) / DAY,
    );
    if (index < 0 || index >= days) continue;

    const bucket = buckets[index];
    buckets[index] = {
      ...bucket,
      listings: bucket.listings + 1,
      offers: bucket.offers + (listing.offer ? 1 : 0),
      accepted: bucket.accepted + (listing.status === "accepted" ? 1 : 0),
    };
  }

  return buckets;
}

/** Live stock by crop, with the price set against the mandi reference. */
export function cropVolumes(
  offers: readonly StockOffer[],
  listings: readonly Listing[],
): CropVolume[] {
  const mandi = new Map(listings.map((l) => [l.produce.id, l.marketRate]));
  const grouped = new Map<string, StockOffer[]>();

  for (const offer of offers) {
    const key = offer.sku.produce.id;
    grouped.set(key, [...(grouped.get(key) ?? []), offer]);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const cheapest = group.reduce((best, o) =>
        o.pricePerUnit < best.pricePerUnit ? o : best,
      );
      const rate = mandi.get(id);
      const low = rate ? marketLow(rate).minorUnits : 0;
      const high = rate ? marketHigh(rate).minorUnits : 0;
      const mid = low && high ? (low + high) / 2 : 0;

      return {
        crop: produceName(cheapest.sku.produce, "en"),
        kg: group.reduce((total, o) => total + o.availableQuantity, 0),
        value: group.reduce(
          (total, o) => total + Math.round(o.pricePerUnit * o.availableQuantity),
          0,
        ),
        price: cheapest.pricePerUnit,
        mandiLow: low,
        mandiHigh: high,
        vsMandi: mid ? ((cheapest.pricePerUnit - mid) / mid) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);
}

/** Share of live stock by grade. */
export function gradeSplit(offers: readonly StockOffer[]): GradeSplit[] {
  const counts = new Map<Grade, number>();
  for (const offer of offers) {
    counts.set(offer.sku.grade, (counts.get(offer.sku.grade) ?? 0) + 1);
  }

  const total = offers.length || 1;

  return (["a", "b", "c"] as const)
    .map((grade) => ({
      grade,
      label: `Grade ${GRADE_LABELS[grade]}`,
      share: Math.round(((counts.get(grade) ?? 0) / total) * 100),
    }))
    .filter((row) => row.share > 0);
}

export function districtRows(
  listings: readonly Listing[],
  offers: readonly StockOffer[],
): DistrictRow[] {
  const rows = new Map<string, { listings: number; farmers: Set<string> }>();

  for (const listing of listings) {
    const key = listing.farmer.district;
    const row = rows.get(key) ?? { listings: 0, farmers: new Set<string>() };
    row.listings += 1;
    row.farmers.add(listing.farmer.id);
    rows.set(key, row);
  }

  const stockByDistrict = new Map<string, number>();
  for (const offer of offers) {
    const key = offer.source.district;
    stockByDistrict.set(
      key,
      (stockByDistrict.get(key) ?? 0) +
        Math.round(offer.pricePerUnit * offer.availableQuantity),
    );
  }

  for (const district of stockByDistrict.keys()) {
    if (!rows.has(district)) {
      rows.set(district, { listings: 0, farmers: new Set() });
    }
  }

  return [...rows.entries()]
    .map(([district, row]) => ({
      district,
      listings: row.listings,
      farmers: row.farmers.size,
      stockValue: stockByDistrict.get(district) ?? 0,
    }))
    .sort((a, b) => b.stockValue - a.stockValue);
}
