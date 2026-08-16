import { GRADES, type Grade } from "./enums";
import type { GradeQuantity } from "./listing-draft";
import { lastProposalBy, type Negotiation } from "./negotiation";

/**
 * Where a lot stands: sold, spoken for, and free.
 *
 * Both sides of the trade were flying blind on the same question. A farmer with
 * four buyers on one lot could see four conversations but not how much of the
 * field was actually committed; a buyer could see a quantity on the market but
 * not that three other people were already bidding for it. Each was making a
 * decision about scarcity without being told whether the thing was scarce.
 *
 * The split is three ways, and the third one is not like the others:
 *
 *  - **Sold** is settled. An agreed bargain took that produce off the lot, and
 *    nothing gives it back.
 *  - **Left** is what remains — posted minus sold — and is what any further
 *    bargain has to fit inside.
 *  - **Under bargain** is *demand*, and it overlaps. Three buyers each bidding
 *    for four hundred of five hundred remaining is twelve hundred under
 *    bargain against five hundred available, because bidding reserves nothing.
 *
 * That last point is why this is not one stacked bar. Demand is not a slice of
 * supply; it is a separate quantity that can exceed it, and the moment it does
 * is exactly the moment a farmer should know they can hold out — and a buyer
 * should know they are one of several.
 *
 * What a buyer is shown is aggregate on purpose. How much rival demand exists
 * is market depth and belongs to both sides; what each rival is *paying* is
 * theirs, and this carries no rates for that reason.
 */

export interface LotLine {
  readonly grade: Grade;
  /** As listed. */
  readonly posted: number;
  /** Taken by agreed bargains. */
  readonly sold: number;
  /** `posted - sold`. What a further bargain has to fit inside. */
  readonly remaining: number;
  /** The viewer's own live bid, where they have one. Always 0 for a farmer. */
  readonly yours: number;
  /** Everyone else's live bids, added up. Overlapping, so it may exceed `remaining`. */
  readonly others: number;
  /** Open bargains carrying a live bid on this grade. */
  readonly bidders: number;
}

export interface LotBook {
  readonly lines: readonly LotLine[];
  readonly posted: number;
  readonly sold: number;
  readonly remaining: number;
  readonly yours: number;
  readonly others: number;
  /** Distinct open bargains with a live bid on any grade of this lot. */
  readonly bidders: number;
  /** More is being bid for than is left. The farmer's position, in one word. */
  readonly oversubscribed: boolean;
  /** Nothing left. The lot is done. */
  readonly soldOut: boolean;
}

/**
 * What a buyer currently has on the table, per grade.
 *
 * Their last proposal, not their first: a bargain that has run four rounds is
 * about the latest numbers, and counting the opening bid would report demand
 * that nobody is offering any more. A thread with no buyer proposal yet — one
 * opened with only a message — contributes nothing, which is right: interest is
 * not a bid.
 */
function liveBid(thread: Negotiation): Map<Grade, number> {
  const out = new Map<Grade, number>();
  const offer = lastProposalBy(thread, "buyer");
  if (!offer?.bands) return out;

  for (const band of offer.bands) {
    // No quantity on a band means the whole lot, as it always did.
    out.set(band.grade, band.quantity ?? thread.quantity);
  }
  return out;
}

/**
 * The state of one lot.
 *
 * `threads` is every bargain on this listing, from every buyer — the farmer's
 * whole picture. Pass `viewerBuyerId` to split the demand into "yours" and
 * "theirs"; leave it out for the farmer, who has no bid of their own.
 */
export function lotBook(input: {
  posted: readonly GradeQuantity[];
  threads: readonly Negotiation[];
  viewerBuyerId?: string;
}): LotBook {
  const { posted, threads, viewerBuyerId } = input;

  const open = threads.filter((t) => t.status === "open");
  const agreed = threads.filter((t) => t.status === "agreed");

  const lines: LotLine[] = [];
  const biddingThreads = new Set<string>();

  for (const grade of GRADES) {
    const listed = posted.find((p) => p.grade === grade)?.quantity ?? 0;

    let sold = 0;
    for (const thread of agreed) {
      for (const band of thread.agreedBands ?? []) {
        if (band.grade !== grade) continue;
        sold += band.quantity ?? listed;
      }
    }

    let yours = 0;
    let others = 0;
    let bidders = 0;

    for (const thread of open) {
      const wanted = liveBid(thread).get(grade) ?? 0;
      if (wanted <= 0) continue;

      bidders += 1;
      biddingThreads.add(thread.id);
      if (viewerBuyerId && thread.buyerId === viewerBuyerId) yours += wanted;
      else others += wanted;
    }

    // A grade nobody listed and nobody wants is not a row. A grade that is
    // fully sold still is — "all of it went" is information.
    if (listed === 0 && sold === 0 && yours === 0 && others === 0) continue;

    lines.push({
      grade,
      posted: listed,
      sold,
      // Never negative. An over-sold lot is a data problem, not a licence to
      // report that the farmer owes produce.
      remaining: Math.max(0, listed - sold),
      yours,
      others,
      bidders,
    });
  }

  const sum = (pick: (l: LotLine) => number) => lines.reduce((t, l) => t + pick(l), 0);

  const remaining = sum((l) => l.remaining);
  const yours = sum((l) => l.yours);
  const others = sum((l) => l.others);

  return {
    lines,
    posted: sum((l) => l.posted),
    sold: sum((l) => l.sold),
    remaining,
    yours,
    others,
    // Counted across grades rather than added up per grade: one buyer bidding
    // on A and B is one bidder, not two.
    bidders: biddingThreads.size,
    oversubscribed: remaining > 0 && yours + others > remaining,
    soldOut: sum((l) => l.posted) > 0 && remaining === 0,
  };
}

/**
 * Every lot at once, for a console showing a list of them.
 *
 * Threads are bucketed by listing first so this stays one pass over the
 * bargains rather than one pass per lot — a farmer with thirty listings and a
 * busy morning would otherwise be quadratic for no reason.
 */
export function lotBooks(input: {
  listings: ReadonlyArray<{ id: string; grades: readonly GradeQuantity[] }>;
  threads: readonly Negotiation[];
  viewerBuyerId?: string;
}): Record<string, LotBook> {
  const byListing = new Map<string, Negotiation[]>();
  for (const thread of input.threads) {
    const bucket = byListing.get(thread.listingId);
    if (bucket) bucket.push(thread);
    else byListing.set(thread.listingId, [thread]);
  }

  const out: Record<string, LotBook> = {};
  for (const listing of input.listings) {
    out[listing.id] = lotBook({
      posted: listing.grades,
      threads: byListing.get(listing.id) ?? [],
      viewerBuyerId: input.viewerBuyerId,
    });
  }
  return out;
}

/** Totals across every lot, for the line at the top of a console. */
export function acrossLots(books: Record<string, LotBook>): {
  posted: number;
  sold: number;
  remaining: number;
  underBargain: number;
  /** Lots with at least one live bid on them. */
  lotsBargaining: number;
  lotsSoldOut: number;
} {
  const all = Object.values(books);
  return {
    posted: all.reduce((t, b) => t + b.posted, 0),
    sold: all.reduce((t, b) => t + b.sold, 0),
    remaining: all.reduce((t, b) => t + b.remaining, 0),
    underBargain: all.reduce((t, b) => t + b.yours + b.others, 0),
    lotsBargaining: all.filter((b) => b.bidders > 0).length,
    lotsSoldOut: all.filter((b) => b.soldOut).length,
  };
}
