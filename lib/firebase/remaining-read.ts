import "server-only";

import type { Grade } from "@/lib/domain/enums";
import type { GradeQuantity } from "@/lib/domain/listing-draft";
import { remainingOn } from "@/lib/domain/partial-bargain";

import { adminDb } from "./admin";
import { shapeNegotiation } from "./negotiations-read";

/**
 * A lot as posted, and what is left of it.
 *
 * Both figures, because callers need different ones and deriving either from
 * the other is where this goes wrong: `remaining` is `posted` minus what has
 * sold, so handing `remaining` to something that expects `posted` subtracts the
 * sales twice and reports a lot smaller than the field.
 *
 * Derived on each call rather than kept as a counter on the listing — a counter
 * goes wrong exactly once and then stays wrong, and the thing it would be wrong
 * about is how much produce a farmer has left.
 */
export interface Lot {
  /** The grades as the farmer listed them. */
  readonly posted: GradeQuantity[];
  /** `posted` minus every agreed bargain. What a further bid must fit inside. */
  readonly remaining: GradeQuantity[];
}

/** An empty lot. What a listing nobody can find reads as. */
const NOTHING: Lot = { posted: [], remaining: [] };

function postedGrades(data: Record<string, unknown>): GradeQuantity[] {
  const grades: GradeQuantity[] = Array.isArray(data.grades)
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
  if (grades.length === 0 && typeof data.quantity === "number" && data.quantity > 0) {
    grades.push({ grade: "a", quantity: data.quantity });
  }

  return grades;
}

/**
 * One lot, posted and remaining.
 *
 * Returns nothing for a listing that does not exist, which the propose guard
 * reads as "nothing available" and refuses. Failing that way round is
 * deliberate: a bid against a listing nobody can find should not go through on
 * the grounds that no limit could be established.
 */
export async function readLot(listingId: string): Promise<Lot> {
  if (!listingId) return NOTHING;

  const db = adminDb();

  const [listing, agreed] = await Promise.all([
    db.collection("listings").doc(listingId).get(),
    db
      .collection("negotiations")
      .where("listingId", "==", listingId)
      .where("status", "==", "agreed")
      .get(),
  ]);

  if (!listing.exists) return NOTHING;

  const posted = postedGrades(listing.data() ?? {});

  return {
    posted,
    remaining: remainingOn(
      posted,
      agreed.docs.map((doc) => shapeNegotiation(doc.id, doc.data())),
    ),
  };
}

/** Several lots at once, keyed by listing id. */
export async function readLots(listingIds: readonly string[]): Promise<Record<string, Lot>> {
  const ids = Array.from(new Set(listingIds.filter(Boolean)));
  const lots = await Promise.all(ids.map(async (id) => [id, await readLot(id)] as const));
  return Object.fromEntries(lots);
}

/** Just the remainder, for callers that only bound a bid. */
export async function readRemaining(listingId: string): Promise<GradeQuantity[]> {
  return (await readLot(listingId)).remaining;
}
