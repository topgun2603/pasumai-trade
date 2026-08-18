import "server-only";

import type { SettledSale } from "@/lib/domain/todays-price";
import { WINDOW_HOURS } from "@/lib/domain/todays-price";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Bargains that actually settled, for the public price section.
 *
 * Two reads, both of collections this platform keeps small: the bargains, and
 * the farmers behind them for the village each was collected from. The listing
 * is not read at all — a negotiation already carries the crop's English name,
 * written from `produce.names.en` when the listing was posted, so the catalogue
 * lookup is exact without a third round trip.
 *
 * Nothing identifying leaves here. The public page shows a crop, a figure, and
 * how many independent agreements stand behind it; who sold and who bought is
 * for the two of them and for operations.
 */

export interface SettledPrices {
  readonly sales: SettledSale[];
  /** False when there is no database to ask, as opposed to nothing to report. */
  readonly live: boolean;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

/**
 * @param produceIdFor Resolves a crop's English name to its catalogue id. Passed
 *   in rather than imported so this module stays free of the catalogue and can
 *   be tested against a stub.
 */
export async function readSettledSales(
  produceIdFor: (produceName: string) => string | undefined,
  now: Date,
): Promise<SettledPrices> {
  if (!hasAdminCredentials()) return { sales: [], live: false };

  try {
    const db = adminDb();
    const oldest = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);

    /*
      Filtered on the server by status, and in memory by date. `agreedAt` is
      only set on threads that reached an agreement, so a range query on it
      alongside the status equality would want a composite index for a
      collection with a few hundred rows in it.
    */
    const snapshot = await db
      .collection("negotiations")
      .where("status", "==", "agreed")
      .get();

    if (snapshot.empty) return { sales: [], live: true };

    const sales: SettledSale[] = [];
    const farmerIds = new Set<string>();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Demo rows are excluded the same way the market excludes them. A price
      // nobody paid is exactly what this section exists to stop showing.
      if (data.seeded === true) continue;

      const agreedAt = toDate(data.agreedAt);
      if (!agreedAt || agreedAt < oldest || agreedAt > now) continue;

      const produceId = produceIdFor(
        typeof data.produceName === "string" ? data.produceName : "",
      );
      if (!produceId) continue;

      const unit = typeof data.unit === "string" ? data.unit : "";
      if (!unit) continue;

      const bands = Array.isArray(data.agreedBands) ? data.agreedBands : [];
      const rates = bands
        .map((band: Record<string, unknown>) =>
          typeof band?.ratePerUnit === "number" ? band.ratePerUnit : NaN,
        )
        .filter((rate: number) => Number.isFinite(rate) && rate > 0);
      if (rates.length === 0) continue;

      const farmerId = typeof data.farmerId === "string" ? data.farmerId : "";
      if (farmerId) farmerIds.add(farmerId);

      /*
        One sale per grade band. A bargain that settled grade A at ₹24 and
        grade B at ₹19 is two prices that both really happened, and folding
        them into one number per thread would let a lot with three grades count
        once while three single-grade lots count three times.
      */
      for (const ratePerUnit of rates) {
        sales.push({ produceId, ratePerUnit, unit, agreedAt, placeId: farmerId });
      }
    }

    if (sales.length === 0) return { sales: [], live: true };

    // Village, so "2 locations" counts places rather than people. Two farmers
    // in one village are one location to a buyer arranging a vehicle.
    const villages = new Map<string, string>();
    const farmers = await db.collection("farmers").get();
    for (const doc of farmers.docs) {
      if (!farmerIds.has(doc.id)) continue;
      const village = doc.data().village;
      if (typeof village === "string" && village) villages.set(doc.id, village);
    }

    return {
      sales: sales.map((sale) => ({
        ...sale,
        placeId: sale.placeId ? (villages.get(sale.placeId) ?? sale.placeId) : undefined,
      })),
      live: true,
    };
  } catch {
    // A public page that fails because the database is unreachable is worse
    // than one showing clearly-marked examples.
    return { sales: [], live: false };
  }
}
