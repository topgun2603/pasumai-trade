import type { VehicleType } from "./admin";
import { money, type Money } from "./money";

/**
 * Agencies quote, the farmer picks.
 *
 * The step between "I need a lorry" and "a lorry is coming". A farmer's request
 * goes out to the agencies that can serve them; each replies with a **specific
 * vehicle and a price**; the farmer chooses. Nobody is committed until the
 * farmer accepts, and the platform never names a freight rate.
 *
 * That last part is the same decision as the produce price, for the same
 * reason: the moment the platform quotes a figure it is answerable for it, and
 * a rate card set in an office is wrong for the road on the day. What the
 * platform does instead is make comparison easy — same vehicle details, same
 * fee, same format, side by side.
 *
 * It replaces first-to-accept-wins, which was quicker and worse: it settled who
 * carried the load without anybody mentioning what it cost, and a farmer found
 * out the price after the lorry was committed.
 */

export type QuoteStatus =
  /** Offered, the farmer has not decided. */
  | "offered"
  /** The farmer took it. Terminal, and the trip is created from it. */
  | "accepted"
  /** The farmer took somebody else's, or called the whole request off. */
  | "passedOver"
  /** The agency pulled it before the farmer chose. */
  | "withdrawn";

export interface FreightQuote {
  readonly id: string;
  /** The request being quoted for. */
  readonly pickupId: string;
  readonly agencyId: string;
  readonly agencyName: string;
  /** The actual vehicle offered, not a class of vehicle. */
  readonly vehicleId: string;
  readonly registration: string;
  readonly vehicleType: VehicleType;
  readonly capacityKg: number;
  readonly refrigerated: boolean;
  /** Whole fee for the trip, in paise. Never a rate per kilometre. */
  readonly feePaise: number;
  /** When the agency says it can be at the farm. */
  readonly canArriveInMinutes?: number;
  readonly driverName?: string;
  readonly driverMobile?: string;
  /** Anything the agency wants to say, from the fixed list. Never free text. */
  readonly noteId?: string;
  readonly status: QuoteStatus;
  readonly offeredAt: Date;
}

export function fee(quote: FreightQuote): Money {
  return money(quote.feePaise);
}

/* -------------------------------------------------------------------------
   Offering
   ------------------------------------------------------------------------- */

export type QuoteRefusal =
  | "notSearching"
  | "expired"
  | "alreadyQuoted"
  | "unsuitable"
  | "badFee";

export interface QuoteResult {
  readonly ok: boolean;
  readonly code?: QuoteRefusal;
  readonly message?: string;
}

/**
 * A fee the platform will carry.
 *
 * Bounded at both ends, and the lower bound matters more than it looks: a
 * quote of zero is not generosity, it is a mistake or a way to win a job and
 * argue about the price at the farm gate. The upper bound catches a fee typed
 * in rupees where paise were meant, which is the error that turns ₹1,200 into
 * ₹1,20,000 and is otherwise invisible until somebody accepts it.
 */
const MIN_FEE_PAISE = 100_00;
const MAX_FEE_PAISE = 5_00_000_00;

export function canQuote(input: {
  /** The request, as it stands. */
  pickup: { status: string; expiresAt: Date };
  /** Quotes this agency has already made on it. */
  existing: readonly FreightQuote[];
  agencyId: string;
  feePaise: number;
  now: number;
}): QuoteResult {
  const { pickup, existing, agencyId, feePaise, now } = input;

  if (pickup.status !== "searching") {
    return {
      ok: false,
      code: "notSearching",
      message:
        pickup.status === "accepted"
          ? "The farmer has already chosen a vehicle."
          : "This request is closed.",
    };
  }

  if (now >= pickup.expiresAt.getTime()) {
    return { ok: false, code: "expired", message: "This request has timed out." };
  }

  // One live quote per agency. An agency that wants to change its price
  // withdraws and re-quotes, so the farmer never sees two prices from one
  // company and has to work out which is current.
  if (existing.some((q) => q.agencyId === agencyId && q.status === "offered")) {
    return {
      ok: false,
      code: "alreadyQuoted",
      message: "You have already quoted for this load. Withdraw it to change the price.",
    };
  }

  if (!Number.isFinite(feePaise) || !Number.isInteger(feePaise)) {
    return { ok: false, code: "badFee", message: "Give the fee in whole rupees." };
  }

  if (feePaise < MIN_FEE_PAISE) {
    return {
      ok: false,
      code: "badFee",
      message: `A trip cannot be quoted under ${MIN_FEE_PAISE / 100} rupees.`,
    };
  }

  if (feePaise > MAX_FEE_PAISE) {
    return {
      ok: false,
      code: "badFee",
      message: "That fee looks like rupees typed where paise were meant. Check the figure.",
    };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------
   Choosing
   ------------------------------------------------------------------------- */

/**
 * Quotes as the farmer should read them, cheapest first.
 *
 * Price leads because it is the thing a farmer is deciding on and the thing
 * they can compare without knowing anything about lorries. Where two quotes
 * cost the same, the one arriving sooner goes first — that is the only other
 * axis most people care about.
 *
 * Withdrawn and passed-over quotes are dropped rather than greyed. A list of
 * prices that are no longer available is a list somebody misreads.
 */
export function inChoosingOrder(quotes: readonly FreightQuote[]): FreightQuote[] {
  return quotes
    .filter((quote) => quote.status === "offered")
    .sort(
      (a, b) =>
        a.feePaise - b.feePaise ||
        (a.canArriveInMinutes ?? Number.MAX_SAFE_INTEGER) -
          (b.canArriveInMinutes ?? Number.MAX_SAFE_INTEGER) ||
        a.offeredAt.getTime() - b.offeredAt.getTime(),
    );
}

/** The cheapest and the soonest, which are rarely the same quote. */
export function highlights(quotes: readonly FreightQuote[]): {
  cheapestId?: string;
  soonestId?: string;
} {
  const live = inChoosingOrder(quotes);
  if (live.length < 2) return {};

  const cheapest = live[0];

  const timed = live.filter((q) => q.canArriveInMinutes !== undefined);
  const soonest = timed.length > 0
    ? timed.reduce((best, q) =>
        (q.canArriveInMinutes ?? 0) < (best.canArriveInMinutes ?? 0) ? q : best,
      )
    : undefined;

  // A tie tells the farmer nothing, and a mark on one of two identical quotes
  // is the platform choosing for them.
  const cheapestTied = live.filter((q) => q.feePaise === cheapest.feePaise).length > 1;

  return {
    cheapestId: cheapestTied ? undefined : cheapest.id,
    soonestId: soonest && soonest.id !== cheapest.id ? soonest.id : undefined,
  };
}

export type AcceptRefusal = "notOffered" | "notSearching" | "expired" | "notYours";

export function canAcceptQuote(input: {
  quote: FreightQuote;
  pickup: { status: string; expiresAt: Date; farmerId: string };
  farmerId: string;
  now: number;
}): { ok: true } | { ok: false; code: AcceptRefusal; message: string } {
  const { quote, pickup, farmerId, now } = input;

  if (pickup.farmerId !== farmerId) {
    return { ok: false, code: "notYours", message: "That is not your request." };
  }

  if (quote.status !== "offered") {
    return {
      ok: false,
      code: "notOffered",
      message:
        quote.status === "withdrawn"
          ? `${quote.agencyName} has withdrawn that quote.`
          : "That quote is no longer on the table.",
    };
  }

  if (pickup.status === "accepted") {
    return {
      ok: false,
      code: "notSearching",
      message: "You have already accepted a quote for this load.",
    };
  }

  if (pickup.status !== "searching") {
    return { ok: false, code: "notSearching", message: "This request is closed." };
  }

  // Deliberately generous: a quote the farmer is looking at when the window
  // closes should still be acceptable for a moment rather than vanishing under
  // their thumb. The request expiring stops *new* quotes, not this decision.
  if (now >= pickup.expiresAt.getTime() + 5 * 60_000) {
    return {
      ok: false,
      code: "expired",
      message: "This request has timed out. Send it again and the agencies will re-quote.",
    };
  }

  return { ok: true };
}
