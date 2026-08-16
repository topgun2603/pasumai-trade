import type { QuantityUnit } from "./enums";
import type { GradeQuantity } from "./listing-draft";
import type { Negotiation } from "./negotiation";

/**
 * Opening a bargain.
 *
 * Buyers could reply to a bargain and never begin one — every thread on the
 * platform was seeded. This is the missing first move, and it is the buyer's
 * to make: a farmer posts what they have and what they are asking, and the
 * buyer either accepts that or opens a conversation about it.
 *
 * One thread per buyer per listing, deliberately. Two threads with the same
 * buyer over the same lot means two prices agreed for produce that exists
 * once, and whichever is honoured, somebody was told something untrue.
 */

export interface ListingForBargain {
  readonly id: string;
  readonly produceName: string;
  readonly farmerId: string;
  readonly farmerName: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly status: string;
  readonly grades: readonly GradeQuantity[];
}

export type StartRefusal = "listingClosed" | "alreadyOpen" | "ownListing";

export function canStart(input: {
  listing: ListingForBargain;
  buyerId: string;
  /** Every thread this buyer already has, on any listing. */
  existing: readonly Negotiation[];
}): { ok: true } | { ok: false; code: StartRefusal; message: string } {
  const { listing, buyerId, existing } = input;

  // A farmer with a buyer account bargaining with themselves would settle a
  // price against nobody and put a real order behind it.
  if (listing.farmerId === buyerId) {
    return { ok: false, code: "ownListing", message: "That is your own listing." };
  }

  if (listing.status === "withdrawn" || listing.status === "expired") {
    return {
      ok: false,
      code: "listingClosed",
      message: "That produce is no longer on the market.",
    };
  }

  const open = existing.find(
    (t) => t.listingId === listing.id && t.buyerId === buyerId && t.status === "open",
  );
  if (open) {
    return {
      ok: false,
      code: "alreadyOpen",
      message: "You already have a bargain open on this lot. Continue it instead.",
    };
  }

  return { ok: true };
}

/**
 * The empty thread a buyer opens.
 *
 * No message and no price. The opening offer, if there is one, is applied
 * afterwards through `applyMessage`, so it goes through exactly the same rules
 * as every later proposal — a first offer that skipped the ordering and expiry
 * checks would be the one proposal on the platform nobody validated.
 */
export function startNegotiation(input: {
  id: string;
  listing: ListingForBargain;
  buyerId: string;
  buyerName: string;
  now: Date;
}): Negotiation {
  const { id, listing, buyerId, buyerName, now } = input;

  return {
    id,
    listingId: listing.id,
    produceName: listing.produceName,
    farmerId: listing.farmerId,
    buyerId,
    farmerName: listing.farmerName,
    buyerName,
    quantity: listing.quantity,
    unit: listing.unit,
    status: "open",
    messages: [],
    openedAt: now,
  };
}

/**
 * What the buyer's first offer starts at, per grade.
 *
 * The farmer's asking price where they gave one, so the buyer is countering a
 * number rather than inventing one — and the grades with no asking price come
 * back empty, because guessing on the farmer's behalf is how an anchor gets
 * set by the platform instead of by either party.
 */
export function openingBands(
  grades: readonly GradeQuantity[],
): Array<{ grade: GradeQuantity["grade"]; ratePerUnit?: number }> {
  return grades.map((g) => ({ grade: g.grade, ratePerUnit: g.askingRate }));
}
