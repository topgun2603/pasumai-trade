import "server-only";

import type { Grade } from "@/lib/domain/enums";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import { GRADES } from "@/lib/domain/enums";
import { remainingOn } from "@/lib/domain/partial-bargain";

import { adminDb, adminStorage } from "./admin";
import { shapeNegotiation } from "./negotiations-read";

/**
 * A farmer's own listings, read from Firestore.
 *
 * The farm console was reading the mock catalogue, so a farmer could post
 * produce, get a 201, and watch it not appear — the write went to Firestore and
 * every page looked somewhere else. This is the other half.
 *
 * It has to cope with two shapes at once. Seeded listings carry a single
 * `quantity` and no grades, because they pre-date the grade split; new ones
 * carry a `grades` array. Rather than migrate demo data, a listing with no
 * grades is read as one lot of unstated grade — which is exactly what it is.
 */

export interface FarmListing {
  readonly id: string;
  /** Whose lot it is. Needed wherever ownership is checked or displayed. */
  readonly farmerId: string;
  readonly produceId: string;
  readonly produceName: string;
  readonly grades: GradeQuantity[];
  /** Sum across grades, or the flat quantity on an older listing. */
  readonly quantity: number;
  readonly unit: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly readyAt?: Date;
  /** Signed, short-lived. The bucket is private; these are not public URLs. */
  readonly imageUrls: string[];
  readonly videoUrl?: string;
  /**
   * The storage paths behind those URLs.
   *
   * The editor needs them: a signed URL expires and cannot be written back,
   * so "keep this photograph" has to mean keeping its path. Kept in the same
   * order as `imageUrls` so the two index together.
   */
  readonly imagePaths: string[];
  readonly videoPath?: string;
  readonly photoCount: number;
  /** True for the seeded demo rows, which have no per-grade breakdown. */
  readonly legacy: boolean;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function readGrades(value: unknown): GradeQuantity[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): GradeQuantity[] => {
    if (!raw || typeof raw !== "object") return [];
    const g = raw as Record<string, unknown>;
    if (!GRADES.includes(g.grade as Grade)) return [];
    const quantity = typeof g.quantity === "number" ? g.quantity : 0;
    if (quantity <= 0) return [];
    // Stored as null when there is no asking price; the domain uses undefined.
    const askingRate =
      typeof g.askingRate === "number" && g.askingRate > 0 ? g.askingRate : undefined;
    return [{ grade: g.grade as Grade, quantity, askingRate }];
  });
}

/**
 * Read URLs for private objects.
 *
 * Signed rather than made public. A produce photograph carries a farmer's
 * name, village and what they are holding, and a permanently public URL is one
 * that outlives the listing and the account. An hour is longer than anyone
 * spends on the page and short enough that a copied link is not a permanent
 * one.
 *
 * Signing is local arithmetic, not a network call, so doing it per image costs
 * nothing worth optimising away.
 */
const READ_TTL_MS = 60 * 60 * 1000;

async function signRead(paths: readonly string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const bucket = adminStorage();
  const expires = Date.now() + READ_TTL_MS;

  const signed = await Promise.all(
    paths.map(async (path) => {
      try {
        const [url] = await bucket
          .file(path)
          .getSignedUrl({ version: "v4", action: "read", expires });
        return url;
      } catch {
        // A path with no object behind it — an upload that half-failed, or a
        // file deleted since. Dropped rather than rendered as a broken image.
        return null;
      }
    }),
  );

  return signed.filter((url): url is string => url !== null);
}

function shape(
  id: string,
  data: Record<string, unknown>,
): Omit<FarmListing, "imageUrls" | "videoUrl" | "imagePaths" | "videoPath"> {
  const grades = readGrades(data.grades);
  const flat = typeof data.quantity === "number" ? data.quantity : 0;

  return {
    id,
    farmerId: typeof data.farmerId === "string" ? data.farmerId : "",
    produceId: typeof data.produceId === "string" ? data.produceId : "",
    produceName: typeof data.produceName === "string" ? data.produceName : (typeof data.produceId === "string" ? data.produceId : "Produce"),
    grades,
    quantity: grades.length > 0 ? grades.reduce((s, g) => s + g.quantity, 0) : flat,
    unit: typeof data.unit === "string" ? data.unit : "kg",
    status: typeof data.status === "string" ? data.status : "awaitingOffer",
    createdAt: toDate(data.createdAt) ?? new Date(0),
    readyAt: toDate(data.readyAt),
    photoCount: typeof data.photoCount === "number" ? data.photoCount : 0,
    legacy: grades.length === 0,
  };
}

/**
 * Everything this farmer has listed, newest first.
 *
 * Queried on two spellings of the id. Seeded listings store `f-201` while
 * account ids are `F-201`, and Firestore's equality is case-sensitive — so
 * asking for one spelling silently returns nothing for the demo accounts,
 * which looks exactly like "the platform lost my produce".
 */
export async function readFarmerListings(farmerId: string): Promise<FarmListing[]> {
  if (!farmerId) return [];

  const spellings = Array.from(new Set([farmerId, farmerId.toLowerCase(), farmerId.toUpperCase()]));

  const snapshot = await adminDb()
    .collection("listings")
    .where("farmerId", "in", spellings.slice(0, 10))
    .get();

  const rows = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const base = shape(doc.id, data);

      const imagePaths = Array.isArray(data.imagePaths)
        ? data.imagePaths.filter((p): p is string => typeof p === "string")
        : [];
      const videoPath = typeof data.videoPath === "string" ? data.videoPath : undefined;

      const [imageUrls, videoUrls] = await Promise.all([
        signRead(imagePaths),
        signRead(videoPath ? [videoPath] : []),
      ]);

      return { ...base, imageUrls, videoUrl: videoUrls[0], imagePaths, videoPath };
    }),
  );

  // Newest first: the thing just posted is the thing being looked for.
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/* -------------------------------------------------------------------------
   What the console counts
   ------------------------------------------------------------------------- */

export interface FarmTotals {
  readonly listings: number;
  readonly open: number;
  readonly quantity: number;
  /** Quantity per grade across every open listing. */
  readonly byGrade: Array<{ grade: Grade; quantity: number }>;
  readonly unit: string;
}

/**
 * The numbers the farmer's console shows.
 *
 * Computed from the listings rather than stored on the account, for the same
 * reason the readiness flags are: a stored counter drifts the first time a
 * listing is deleted by hand and then the console insists on produce that is
 * not there.
 */
export function farmTotals(listings: readonly FarmListing[]): FarmTotals {
  const open = listings.filter((l) => l.status !== "withdrawn" && l.status !== "expired");

  const byGrade = GRADES.map((grade) => ({
    grade,
    quantity: open.reduce(
      (sum, l) => sum + (l.grades.find((g) => g.grade === grade)?.quantity ?? 0),
      0,
    ),
  })).filter((g) => g.quantity > 0);

  return {
    listings: listings.length,
    open: open.length,
    quantity: open.reduce((sum, l) => sum + l.quantity, 0),
    byGrade,
    // Mixed units across crops are possible in principle; in practice this
    // platform weighs everything in kg and the label follows the first listing
    // rather than pretending to add kg to bunches.
    unit: open[0]?.unit ?? "kg",
  };
}

/* -------------------------------------------------------------------------
   The market, as a buyer sees it
   ------------------------------------------------------------------------- */

export interface MarketListing extends FarmListing {
  /**
   * The grades as the farmer listed them, before anything sold.
   *
   * `grades` on this type is the *remainder* — what a buyer can still bid for,
   * which is what the market is for. Anything that needs to reason about how
   * much has gone needs the original, and deriving it by adding the sales back
   * is exactly the arithmetic that goes wrong. So both are carried, named for
   * what they are.
   */
  readonly posted: GradeQuantity[];
  readonly farmerName: string;
  readonly village: string;
  readonly district: string;
  /** Completed orders — the only real signal of reliability a buyer has. */
  readonly completedOrders: number;
}

/**
 * Every lot on the market, with the farmer attached.
 *
 * Joined here rather than denormalised onto the listing, because a farmer's
 * name and village change and a listing written last month should not go on
 * showing where they used to live. One read of the farmers collection covers
 * every row — at this scale that is cheaper than the alternative and always
 * current.
 *
 * Withdrawn lots are excluded, and so is seeded demo data. A buyer bargaining
 * for produce that does not exist, with a farmer who cannot be telephoned, is a
 * conversation that ends in an apology — and it is worse than an empty market,
 * because an empty market is at least true.
 *
 * The seeded rows carry `seeded: true`, written by the seed and by
 * scripts/restore-listings.ts. Marked rather than guessed at from the shape of
 * the id: `L-` is a convention, and a convention is a thing somebody
 * reasonably breaks later.
 */
export async function readMarketListings(): Promise<MarketListing[]> {
  const db = adminDb();
  const [listings, farmers, sold] = await Promise.all([
    db.collection("listings").get(),
    db.collection("farmers").get(),
    // Every settled bargain, so a lot half-sold shows what is actually left.
    // A buyer who bids for four hundred against a listing with a hundred and
    // fifty on it has wasted a round, and the farmer has to explain why.
    db.collection("negotiations").where("status", "==", "agreed").get(),
  ]);

  const agreed = sold.docs.map((doc) => shapeNegotiation(doc.id, doc.data()));

  // Indexed on both spellings: seeded rows say `f-201` where accounts say
  // `F-201`, and a case-sensitive lookup silently drops every demo listing.
  const byId = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of farmers.docs) {
    byId.set(doc.id.toLowerCase(), doc.data());
  }

  const rows = await Promise.all(
    listings.docs.map(async (doc): Promise<MarketListing | null> => {
      const data = doc.data();
      if (data.seeded === true) return null;

      const posted = shape(doc.id, data);
      if (posted.status === "withdrawn" || posted.status === "expired") return null;

      // What is left, not what was posted. Derived from the settled bargains
      // rather than decremented on the listing: a counter goes wrong once and
      // then stays wrong, and what it would be wrong about is how much produce
      // exists.
      const left = remainingOn(
        posted.grades,
        agreed.filter((n) => n.listingId === doc.id),
      );

      // Nothing left is not a market row. The lot is sold; showing it with a
      // Bargain button would be an invitation to a conversation that ends in
      // "somebody already took it".
      if (posted.grades.length > 0 && left.length === 0) return null;

      const base = {
        ...posted,
        grades: left.length > 0 ? left : posted.grades,
        quantity: left.length > 0 ? left.reduce((s, g) => s + g.quantity, 0) : posted.quantity,
      };

      const farmerId = typeof data.farmerId === "string" ? data.farmerId : "";
      const farmer = byId.get(farmerId.toLowerCase());

      const imagePaths = Array.isArray(data.imagePaths)
        ? data.imagePaths.filter((p): p is string => typeof p === "string")
        : [];
      const videoPath = typeof data.videoPath === "string" ? data.videoPath : undefined;

      const [imageUrls, videoUrls] = await Promise.all([
        signRead(imagePaths),
        signRead(videoPath ? [videoPath] : []),
      ]);

      return {
        ...base,
        imageUrls,
        videoUrl: videoUrls[0],
        imagePaths,
        videoPath,
        // Falls back to whatever the listing itself recorded, so a lot whose
        // farmer document is missing still renders instead of vanishing.
        farmerName:
          (typeof farmer?.name === "string" ? farmer.name : undefined) ??
          (typeof data.farmerName === "string" ? data.farmerName : "Farmer"),
        village:
          (typeof farmer?.village === "string" ? farmer.village : undefined) ??
          (typeof data.village === "string" ? data.village : ""),
        district:
          (typeof farmer?.district === "string" ? farmer.district : undefined) ??
          (typeof data.district === "string" ? data.district : ""),
        completedOrders: typeof farmer?.completedOrders === "number" ? farmer.completedOrders : 0,
        // Kept alongside the remainder so callers can tell "how much is left"
        // from "how much there was" without subtracting the sales twice.
        posted: posted.grades,
      };
    }),
  );

  return rows
    .filter((r): r is MarketListing => r !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
