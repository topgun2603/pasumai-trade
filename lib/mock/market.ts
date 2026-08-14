import type { Grade, QuantityUnit } from "@/lib/domain/enums";
import type { PickupArea, Sku, StockOffer } from "@/lib/domain/market";
import { isPoint, nearestKm, type Point } from "@/lib/domain/distance";
import { districtSummary, placesIn } from "@/lib/domain/location";
import { money } from "@/lib/domain/money";
import { DEFAULT_POLICY } from "@/lib/domain/policy";

import { CATALOGUE } from "./catalogue";
import { GEOGRAPHY } from "./locations";

/**
 * Seeded marketplace stock.
 *
 * Every lot sits at a **place** — the farm's village — because that is where
 * the vehicle stops. Lots roll up to a district for ordering, since one
 * district is one vehicle run.
 */

const HOUR = 3_600_000;

/**
 * The point every distance on the market is measured from.
 *
 * A function rather than a constant because `CURRENT_BUYER` is declared below
 * and will become a session lookup — at which point this is the one line that
 * changes, and every distance on the platform follows.
 */
function buyerPoint(): Point | null {
  return isPoint(CURRENT_BUYER) ? CURRENT_BUYER : null;
}

function pickupArea(districtId: string, from: Point | null): PickupArea {
  const district = GEOGRAPHY.districts.find((d) => d.id === districtId)!;
  const places = placesIn(GEOGRAPHY, districtId);
  const summary = districtSummary(GEOGRAPHY, districtId);

  return {
    districtId,
    district: district.name,
    stateId: district.stateId,
    // The nearest farm in the district, measured from *this* buyer. Null when
    // either end is unpinned — the screen has to say "not known", because a
    // freight figure invented from a missing location looks exactly like a
    // real one.
    distanceKm: nearestKm(from, places, DEFAULT_POLICY.roadFactorPercent),
    farmerCount: summary.farmers,
    // The district's own minimum, set from Controls. Falling back to the
    // platform default rather than to zero — a district with no figure must
    // not become the one district any order can trigger a vehicle for.
    minOrderValue: money(
      district.minOrderValue ?? DEFAULT_POLICY.defaultMinOrderValue,
    ),
  };
}

function sku(
  produceId: string,
  grade: Grade,
  unit: QuantityUnit,
  packSize: number,
  packLabel: string,
): Sku {
  return {
    id: `${produceId}-${grade}`,
    produce: CATALOGUE[produceId],
    grade,
    unit,
    packSize,
    packLabel,
  };
}

export function stockOffers(now: Date): StockOffer[] {
  const t = now.getTime();

  const rows: Array<{
    id: string;
    sku: Sku;
    placeId: string;
    price: number;
    available: number;
    minOrder: number;
    gradedHoursAgo: number;
    shelfLifeHours: number;
  }> = [
    { id: "S-9001", sku: sku("tomato", "a", "kg", 25, "25 kg crate"), placeId: "tn-kaveripattinam", price: 2600, available: 3200, minOrder: 100, gradedHoursAgo: 6, shelfLifeHours: 96 },
    { id: "S-9002", sku: sku("tomato", "b", "kg", 25, "25 kg crate"), placeId: "tn-kaveripattinam", price: 2100, available: 1850, minOrder: 100, gradedHoursAgo: 6, shelfLifeHours: 72 },
    { id: "S-9003", sku: sku("tomato", "c", "kg", 25, "25 kg crate"), placeId: "tn-bargur", price: 1400, available: 940, minOrder: 200, gradedHoursAgo: 6, shelfLifeHours: 20 },
    { id: "S-9004", sku: sku("tomato", "a", "kg", 25, "25 kg crate"), placeId: "tn-thammampatti", price: 2480, available: 1400, minOrder: 100, gradedHoursAgo: 14, shelfLifeHours: 80 },

    { id: "S-9010", sku: sku("banana", "a", "kg", 20, "20 kg box"), placeId: "tn-bhavani", price: 3300, available: 4100, minOrder: 200, gradedHoursAgo: 9, shelfLifeHours: 120 },
    { id: "S-9011", sku: sku("banana", "b", "kg", 20, "20 kg box"), placeId: "tn-gobichettipalayam", price: 2750, available: 2600, minOrder: 200, gradedHoursAgo: 9, shelfLifeHours: 84 },

    { id: "S-9020", sku: sku("onion", "a", "bag", 1, "50 kg bag"), placeId: "tn-thammampatti", price: 142_000, available: 310, minOrder: 10, gradedHoursAgo: 30, shelfLifeHours: 480 },
    { id: "S-9021", sku: sku("onion", "b", "bag", 1, "50 kg bag"), placeId: "tn-attur", price: 118_000, available: 190, minOrder: 10, gradedHoursAgo: 30, shelfLifeHours: 400 },

    { id: "S-9030", sku: sku("brinjal", "a", "crate", 1, "20 kg crate"), placeId: "tn-attur", price: 52_500, available: 96, minOrder: 5, gradedHoursAgo: 4, shelfLifeHours: 52 },

    { id: "S-9040", sku: sku("turmeric", "a", "quintal", 1, "1 quintal sack"), placeId: "tn-bhavani", price: 806_000, available: 62, minOrder: 2, gradedHoursAgo: 48, shelfLifeHours: 4000 },
    { id: "S-9041", sku: sku("turmeric", "b", "quintal", 1, "1 quintal sack"), placeId: "tn-gobichettipalayam", price: 742_000, available: 38, minOrder: 2, gradedHoursAgo: 48, shelfLifeHours: 4000 },

    { id: "S-9050", sku: sku("groundnut", "a", "quintal", 1, "1 quintal sack"), placeId: "tn-kumbakonam", price: 668_000, available: 44, minOrder: 2, gradedHoursAgo: 26, shelfLifeHours: 2000 },

    { id: "S-9060", sku: sku("mango", "a", "crate", 1, "10 kg crate"), placeId: "tn-kaveripattinam", price: 112_000, available: 180, minOrder: 10, gradedHoursAgo: 7, shelfLifeHours: 64 },
    { id: "S-9061", sku: sku("mango", "b", "crate", 1, "10 kg crate"), placeId: "tn-bargur", price: 86_000, available: 120, minOrder: 10, gradedHoursAgo: 7, shelfLifeHours: 18 },

    { id: "S-9070", sku: sku("drumstick", "a", "kg", 10, "10 kg bundle"), placeId: "tn-pennagaram", price: 5300, available: 420, minOrder: 50, gradedHoursAgo: 11, shelfLifeHours: 90 },
    { id: "S-9080", sku: sku("chilli", "a", "kg", 10, "10 kg bag"), placeId: "tn-thammampatti", price: 7400, available: 260, minOrder: 25, gradedHoursAgo: 5, shelfLifeHours: 108 },
  ];

  return rows.map((r) => {
    const place = GEOGRAPHY.places.find((p) => p.id === r.placeId)!;
    return {
      id: r.id,
      sku: r.sku,
      placeId: place.id,
      place: place.name,
      source: pickupArea(place.districtId, buyerPoint()),
      pricePerUnit: r.price,
      availableQuantity: r.available,
      minOrderQuantity: r.minOrder,
      gradedAt: new Date(t - r.gradedHoursAgo * HOUR),
      bestBefore: new Date(t + r.shelfLifeHours * HOUR),
    };
  });
}

/**
 * Districts stock is available from, nearest to this buyer first.
 *
 * Districts whose distance is unknown sort last. They are unmeasured, not
 * close, and putting one at the top of a nearest-first list is the entry a
 * buyer would wrongly reach for.
 */
export function pickupAreas(): PickupArea[] {
  const ids = [...new Set(GEOGRAPHY.places.map((p) => p.districtId))];
  return ids
    .map((id) => pickupArea(id, buyerPoint()))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

/** The signed-in buyer. Replaced by the session once auth lands. */
export const CURRENT_BUYER = {
  name: "Kongu Agri Traders",
  /** Contracted franchise or independent bulk buyer — same capabilities. */
  isFranchise: true,
  placeId: "tn-hosur",
  districtId: "tn-krishnagiri",
  /** Where this buyer takes delivery. Every distance on the market is from here. */
  lat: 12.7409,
  lng: 77.8253,
  /**
   * Districts this account may source from. Set by operations on the buyer
   * record; scopes the market, the supplier list and dispatch.
   */
  districts: ["Krishnagiri", "Dharmapuri", "Salem", "Erode", "Thanjavur"],
};
