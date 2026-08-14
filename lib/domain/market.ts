/**
 * The buyer-side marketplace.
 *
 * Where `listings` is the supply side — one farmer's lot, negotiated band by
 * band — this is the demand side: aggregated, priced, orderable stock.
 *
 * **Scope, deliberately narrow for now.** There is exactly one kind of buyer:
 * a bulk buyer. A contracted franchise and an independent bulk buyer are the
 * same role with the same capabilities; "franchise" is a label on the account,
 * not a different set of permissions. Small buyers, and any downstream resale
 * tier, are out of scope and deferred.
 *
 * The platform does not own stock. It brokers between farmers and bulk buyers,
 * so a catalogue entry is availability at a collection point, not inventory on
 * a balance sheet.
 */
import type { Grade, QuantityUnit } from "./enums";
import { forQuantity, money, type Money } from "./money";
import type { Produce } from "./models";

/**
 * Where a load is picked up from, and what a cart splits on.
 *
 * Produce is collected **at the farm** — the vehicle goes to the field and
 * grading happens in front of the farmer. There is no pooling shed, so this
 * is not a place the platform owns; it is the district a vehicle runs through,
 * calling at the farms within it.
 *
 * That is why one order is one district: one district is one vehicle run. A
 * cart spanning two districts is two runs, two arrival times and two orders,
 * however it was checked out.
 */
export interface PickupArea {
  /** District id from the geography reference data. */
  readonly districtId: string;
  readonly district: string;
  readonly stateId: string;
  /**
   * Road kilometres to the nearest farm in the district, from this buyer.
   *
   * Null when the buyer or every village in the district is unpinned. Callers
   * must render the absence rather than defaulting it — an unknown distance
   * shown as `0 km` is a promise nobody can keep.
   */
  readonly distanceKm: number | null;
  /** Farmers registered across the district. A thin pool is a supply risk. */
  readonly farmerCount: number;
  /** Below this a vehicle will not be sent — freight stops paying. */
  readonly minOrderValue: Money;
}

/**
 * A standardised, sellable unit.
 *
 * The layer a catalogue needs and a raw listing cannot provide: one farmer's
 * 1,180 kg of tomatoes is a lot, not a product. Grading pools many lots into a
 * few SKUs that can carry a price.
 */
export interface Sku {
  readonly id: string;
  readonly produce: Produce;
  readonly grade: Grade;
  /** The unit the price is quoted in. */
  readonly unit: QuantityUnit;
  /** How the stock is physically packed, e.g. a 25 kg crate. */
  readonly packSize: number;
  readonly packLabel: string;
}

/** Available stock of one SKU in one pickup area, at today's price. */
export interface StockOffer {
  readonly id: string;
  readonly sku: Sku;
  /** The farm's village. Where the vehicle actually stops. */
  readonly placeId: string;
  readonly place: string;
  readonly source: PickupArea;
  /** Per `sku.unit`, in minor units. */
  readonly pricePerUnit: number;
  /** In `sku.unit`. What is actually on hand right now. */
  readonly availableQuantity: number;
  readonly minOrderQuantity: number;
  readonly gradedAt: Date;
  /**
   * Produce is perishable, which is why catalogue prices move daily rather
   * than sitting in a field someone edits. Stock near this date should be
   * discounted, not hidden.
   */
  readonly bestBefore: Date;
}

export function offerUnitPrice(offer: StockOffer): Money {
  return money(offer.pricePerUnit);
}

export function offerLineTotal(offer: StockOffer, quantity: number): Money {
  return forQuantity(offer.pricePerUnit, quantity);
}

/** Hours of shelf life left. Drives the badge now, the price later. */
export function hoursOfShelfLife(offer: StockOffer, now: number): number {
  return Math.max(0, (offer.bestBefore.getTime() - now) / 3_600_000);
}

export type Freshness = "fresh" | "useSoon" | "endOfLife";

/**
 * Which band this stock is in.
 *
 * `bands` comes from `freshnessBands(policy, crop.shelfLifeHours)`. It is
 * optional so existing callers keep the values the platform shipped with,
 * rather than every call site having to thread policy through at once.
 */
export function freshness(
  offer: StockOffer,
  now: number,
  bands: { endOfLife: number; useSoon: number } = {
    endOfLife: 24,
    useSoon: 60,
  },
): Freshness {
  const hours = hoursOfShelfLife(offer, now);
  if (hours <= bands.endOfLife) return "endOfLife";
  if (hours <= bands.useSoon) return "useSoon";
  return "fresh";
}

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  fresh: "Fresh",
  useSoon: "Use soon",
  endOfLife: "Today only",
};

/* -------------------------------------------------------------------------
   Cart
   ------------------------------------------------------------------------- */

export interface CartLine {
  readonly offerId: string;
  /** In the offer's SKU unit. */
  readonly quantity: number;
}

export interface ResolvedLine {
  readonly offer: StockOffer;
  readonly quantity: number;
  readonly total: Money;
}

/**
 * A cart split by pickup district.
 *
 * Not a presentation choice — one basket is one vehicle run. A checkout
 * spanning two districts produces two orders with two vehicles and two arrival
 * times, so the split has to exist in the model or checkout will quietly
 * assume a single run.
 */
export interface SourceBasket {
  readonly source: PickupArea;
  readonly lines: readonly ResolvedLine[];
  readonly subtotal: Money;
  readonly meetsMinimum: boolean;
  readonly shortfall: Money;
  /** Villages the vehicle will call at, in order of distance. */
  readonly stops: readonly string[];
}

export function resolveCart(
  lines: readonly CartLine[],
  offers: readonly StockOffer[],
): SourceBasket[] {
  const byId = new Map(offers.map((o) => [o.id, o]));
  const baskets = new Map<
    string,
    { source: PickupArea; lines: ResolvedLine[] }
  >();

  for (const line of lines) {
    const offer = byId.get(line.offerId);
    if (!offer || line.quantity <= 0) continue;

    const existing = baskets.get(offer.source.districtId) ?? {
      source: offer.source,
      lines: [],
    };
    existing.lines.push({
      offer,
      quantity: line.quantity,
      total: offerLineTotal(offer, line.quantity),
    });
    baskets.set(offer.source.districtId, existing);
  }

  return [...baskets.values()]
    .map(({ source, lines: resolved }) => {
      const subtotal = money(
        resolved.reduce((total, l) => total + l.total.minorUnits, 0),
      );
      const shortfallMinor = Math.max(
        0,
        source.minOrderValue.minorUnits - subtotal.minorUnits,
      );
      return {
        source,
        lines: resolved,
        subtotal,
        meetsMinimum: shortfallMinor === 0,
        shortfall: money(shortfallMinor),
        // The stops the driver actually makes. Deduplicated: two lots from the
        // same village are one call, not two.
        stops: [...new Set(resolved.map((l) => l.offer.place))].sort(),
      };
    })
    // Nearest basket first; unmeasured districts last rather than first.
    .sort(
      (a, b) =>
        (a.source.distanceKm ?? Infinity) - (b.source.distanceKm ?? Infinity),
    );
}

export function cartTotal(baskets: readonly SourceBasket[]): Money {
  return money(baskets.reduce((total, b) => total + b.subtotal.minorUnits, 0));
}

export function cartLineCount(lines: readonly CartLine[]): number {
  return lines.filter((l) => l.quantity > 0).length;
}
