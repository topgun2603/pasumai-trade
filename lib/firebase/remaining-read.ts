import "server-only";

import type { Grade } from "@/lib/domain/enums";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import { remainingOn } from "@/lib/domain/partial-bargain";

import { adminDb } from "./admin";
import { shapeNegotiation } from "./negotiations-read";

/**
 * What is still unsold on a listing.
 *
 * Two reads, both authoritative: the listing as posted, and every bargain
 * already agreed against it. Derived on each call rather than kept as a counter
 * on the listing — a counter goes wrong exactly once and then stays wrong, and
 * the thing it would be wrong about is how much produce a farmer has left.
 *
 * Returns an empty list for a listing that does not exist, which the propose
 * guard reads as "nothing available" and refuses. Failing that way round is
 * deliberate: a bid against a listing nobody can find should not go through on
 * the grounds that no limit could be established.
 */
export async function readRemaining(listingId: string): Promise<GradeQuantity[]> {
  if (!listingId) return [];

  const db = adminDb();

  const [listing, agreed] = await Promise.all([
    db.collection("listings").doc(listingId).get(),
    db
      .collection("negotiations")
      .where("listingId", "==", listingId)
      .where("status", "==", "agreed")
      .get(),
  ]);

  if (!listing.exists) return [];

  const data = listing.data() ?? {};

  const posted: GradeQuantity[] = Array.isArray(data.grades)
    ? data.grades
        .filter(
          (g: unknown): g is { grade: Grade; quantity: number } =>
            !!g &&
            typeof (g as { quantity?: unknown }).quantity === "number" &&
            typeof (g as { grade?: unknown }).grade === "string",
        )
        .map((g) => ({ grade: g.grade, quantity: g.quantity }))
    : [];

  // A listing from before grades were separated stores one flat quantity. It
  // is all one grade as far as anyone knew at the time, so it counts as grade A
  // rather than as nothing — otherwise every older lot reads as sold out.
  if (posted.length === 0 && typeof data.quantity === "number" && data.quantity > 0) {
    posted.push({ grade: "a", quantity: data.quantity });
  }

  return remainingOn(
    posted,
    agreed.docs.map((doc) => shapeNegotiation(doc.id, doc.data())),
  );
}
