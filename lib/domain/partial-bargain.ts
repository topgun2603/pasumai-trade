import { GRADES, type Grade } from "./enums";
import type { GradeQuantity } from "./listing-draft";
import type { Negotiation } from "./negotiation";

/**
 * Bidding for part of a lot.
 *
 * A bargain used to be for everything a farmer had posted, which is not how
 * produce is bought: a hotel wants two hundred kilos of grade A and has no use
 * for the B, and a farmer holding eight hundred would rather sell it in three
 * pieces than not at all.
 *
 * So a bid names a quantity per grade, and several buyers can be bidding for
 * overlapping parts of the same lot at once. Nothing is reserved by bidding —
 * the produce is committed only when the farmer accepts, and what is left is
 * what remains for everybody else.
 */

export interface BidLine {
  readonly grade: Grade;
  /** Units wanted at this grade, in the listing's unit. */
  readonly quantity: number;
  /** Paise per unit. */
  readonly ratePerUnit: number;
}

export type BidRefusal = "empty" | "exceedsAvailable" | "notOffered" | "badQuantity";

/**
 * Can this bid be made against what is left?
 *
 * `remaining` is the lot minus everything already settled, not the lot as
 * posted. Two buyers can each be offered the same two hundred kilos while both
 * bargains are open; the second one to be accepted is the one that has to fit
 * in what is left.
 */
export function canBid(
  lines: readonly BidLine[],
  remaining: readonly GradeQuantity[],
): { ok: true } | { ok: false; code: BidRefusal; message: string } {
  const wanted = lines.filter((l) => l.quantity > 0);

  if (wanted.length === 0) {
    return { ok: false, code: "empty", message: "Say how much you want of at least one grade." };
  }

  for (const line of wanted) {
    if (!Number.isFinite(line.quantity) || !Number.isInteger(line.quantity)) {
      return {
        ok: false,
        code: "badQuantity",
        message: `Grade ${line.grade.toUpperCase()}: enter a whole number.`,
      };
    }

    const available = remaining.find((r) => r.grade === line.grade)?.quantity ?? 0;

    if (available <= 0) {
      return {
        ok: false,
        code: "notOffered",
        message: `Grade ${line.grade.toUpperCase()} is not available on this lot.`,
      };
    }

    if (line.quantity > available) {
      return {
        ok: false,
        code: "exceedsAvailable",
        message: `Only ${available} left at grade ${line.grade.toUpperCase()}.`,
      };
    }
  }

  return { ok: true };
}

/**
 * What is still unsold on a listing.
 *
 * The posted quantities minus every bargain that has been agreed against them.
 * Derived rather than decremented on the listing, so a bargain corrected or
 * removed does not leave the lot permanently short — the same reason nothing
 * else on this platform stores a counter.
 */
export function remainingOn(
  posted: readonly GradeQuantity[],
  settled: readonly Negotiation[],
): GradeQuantity[] {
  const taken = new Map<Grade, number>();

  for (const thread of settled) {
    if (thread.status !== "agreed") continue;
    for (const band of thread.agreedBands ?? []) {
      // A band with no quantity is a whole-lot agreement from before bids
      // carried one. Counted as the full posted amount for that grade, which
      // is what it meant.
      const amount =
        band.quantity ?? posted.find((p) => p.grade === band.grade)?.quantity ?? 0;
      taken.set(band.grade, (taken.get(band.grade) ?? 0) + amount);
    }
  }

  return GRADES.flatMap((grade) => {
    const total = posted.find((p) => p.grade === grade)?.quantity ?? 0;
    const left = Math.max(0, total - (taken.get(grade) ?? 0));
    return left > 0 ? [{ grade, quantity: left }] : [];
  });
}

/** Everything on a bid, across grades. */
export function bidQuantity(lines: readonly BidLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, l.quantity), 0);
}

/** What a bid is worth, in paise, if it were accepted as offered. */
export function bidValue(lines: readonly BidLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, l.quantity) * l.ratePerUnit, 0);
}

/* -------------------------------------------------------------------------
   Comparing offers
   ------------------------------------------------------------------------- */

export interface BidStanding {
  readonly negotiationId: string;
  readonly quantity: number;
  readonly value: number;
  /** Highest rate across the grades bid on, for the "top bid" mark. */
  readonly topRate: number;
}

/**
 * Where each open bargain stands against the others.
 *
 * A farmer with four buyers on one lot is comparing two different things at
 * once — who is paying most per kilo, and who is taking most off their hands —
 * and they are rarely the same buyer. Both are marked rather than combined
 * into a score, because which one matters depends on things the platform
 * cannot see: whether the rest will keep, whether a lorry is already coming.
 */
export function rank(
  threads: readonly Negotiation[],
  standingFor: (thread: Negotiation) => BidLine[],
): {
  readonly standings: readonly BidStanding[];
  readonly topBidId?: string;
  readonly topQuantityId?: string;
} {
  const standings: BidStanding[] = threads
    .filter((t) => t.status === "open")
    .map((thread) => {
      const lines = standingFor(thread);
      return {
        negotiationId: thread.id,
        quantity: bidQuantity(lines),
        value: bidValue(lines),
        topRate: lines.reduce((best, l) => Math.max(best, l.ratePerUnit), 0),
      };
    })
    .filter((s) => s.quantity > 0 || s.topRate > 0);

  // Ties leave the mark off entirely. Two buyers at the same rate are not
  // "the top bid" and pretending one of them is would be the platform picking
  // a winner on nothing.
  const best = (key: "topRate" | "quantity") => {
    const sorted = [...standings].sort((a, b) => b[key] - a[key]);
    if (sorted.length === 0) return undefined;
    if (sorted.length > 1 && sorted[0][key] === sorted[1][key]) return undefined;
    return sorted[0][key] > 0 ? sorted[0].negotiationId : undefined;
  };

  return { standings, topBidId: best("topRate"), topQuantityId: best("quantity") };
}
