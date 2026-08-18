import "server-only";

import type {
  AccountFact,
  BargainFact,
  ListingFact,
} from "@/lib/domain/platform-analytics";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * The records the analytics page reasons over.
 *
 * Everything it needs and nothing more: no names, no mobile numbers, no
 * addresses. An aggregate page has no business loading the fields it will
 * never show, and reading only what is charted means a screenshot of this page
 * can never contain somebody's telephone number.
 *
 * Five collection reads. At this scale that is right; when it stops being
 * right the answer is a rollup written nightly rather than a bigger query, and
 * the seam is this file.
 */

export interface AnalyticsData {
  readonly listings: ListingFact[];
  readonly bargains: BargainFact[];
  readonly accounts: AccountFact[];
  /** False when there is no database to ask, so the page can say so. */
  readonly live: boolean;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

const EMPTY: AnalyticsData = { listings: [], bargains: [], accounts: [], live: false };

export async function readAnalytics(): Promise<AnalyticsData> {
  if (!hasAdminCredentials()) return EMPTY;

  try {
    const db = adminDb();
    const [listingDocs, bargainDocs, farmerDocs, buyerDocs, agencyDocs] = await Promise.all([
      db.collection("listings").get(),
      db.collection("negotiations").get(),
      db.collection("farmers").get(),
      db.collection("buyers").get(),
      db.collection("agencies").get(),
    ]);

    const listings = listingDocs.docs.map((doc): ListingFact => {
      const data = doc.data();
      return {
        id: doc.id,
        produceName: typeof data.produceName === "string" ? data.produceName : "Unknown",
        district: typeof data.district === "string" ? data.district : "",
        quantity: typeof data.quantity === "number" ? data.quantity : 0,
        unit: typeof data.unit === "string" ? data.unit : "kg",
        status: typeof data.status === "string" ? data.status : "unknown",
        createdAt: toDate(data.createdAt) ?? new Date(0),
        seeded: data.seeded === true,
      };
    });

    const bargains = bargainDocs.docs.map((doc): BargainFact => {
      const data = doc.data();
      const bands = Array.isArray(data.agreedBands) ? data.agreedBands : [];

      return {
        id: doc.id,
        produceName: typeof data.produceName === "string" ? data.produceName : "Unknown",
        status: typeof data.status === "string" ? data.status : "open",
        openedAt: toDate(data.openedAt) ?? new Date(0),
        agreedAt: toDate(data.agreedAt),
        unit: typeof data.unit === "string" ? data.unit : "kg",
        rates: bands.flatMap((band: Record<string, unknown>) =>
          typeof band?.ratePerUnit === "number" && typeof band?.grade === "string"
            ? [{ grade: band.grade, ratePerUnit: band.ratePerUnit }]
            : [],
        ),
      };
    });

    const status = (data: Record<string, unknown>) =>
      typeof data.status === "string" ? data.status : "pending";

    const accounts: AccountFact[] = [
      ...farmerDocs.docs.map((doc) => ({ kind: "farmer" as const, status: status(doc.data()) })),
      ...buyerDocs.docs.map((doc) => ({ kind: "buyer" as const, status: status(doc.data()) })),
      ...agencyDocs.docs.map((doc) => ({ kind: "agency" as const, status: status(doc.data()) })),
    ];

    return { listings, bargains, accounts, live: true };
  } catch {
    // A dashboard that 500s because one collection was slow is worse than one
    // that says it could not read anything.
    return EMPTY;
  }
}
