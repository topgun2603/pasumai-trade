/**
 * Price bargaining between a farmer and a buyer.
 *
 * A negotiation is a thread of messages against one listing. Most messages are
 * talk; some carry a **proposal** — a full set of grade rates the other side
 * can accept with one tap. Accepting is binding, and produces the terms the
 * procurement order is created from.
 *
 * Three decisions shape everything here:
 *
 *  - **Grades trade separately.** A proposal prices any subset — a buyer who
 *    wants only the top grade bids on grade A alone, and the rest of the lot
 *    is simply not part of that deal. What a priced grade still guarantees is
 *    that grading at the farm gate resolves its price rather than reopening
 *    it, which is what makes the handover a weighing and not an argument.
 *
 *  - **A party may not move away from the other.** Once a buyer has offered
 *    ₹22, they cannot later offer ₹20. Without that rule a buyer can ratchet
 *    down each time the farmer concedes, and the farmer — who has no way to
 *    check what was said three messages ago while standing in a field — has no
 *    defence against it.
 *
 *  - **Nobody accepts their own proposal.** Obvious, and the single most
 *    important guard in the file: it is the difference between an agreement
 *    and one party writing the price down.
 *
 * The thread is the commercial record. Messages are append-only — nothing here
 * edits or deletes one, because the whole value of a written bargain is that
 * neither side can revise it afterwards.
 */
import type { Grade, QuantityUnit } from "./enums";
import { GRADES, GRADE_LABELS } from "./enums";
import { forQuantity, money, type Money } from "./money";
import type { GradeBand } from "./models";

/* -------------------------------------------------------------------------
   Shape
   ------------------------------------------------------------------------- */

/** Only two parties bargain. The platform never proposes a price. */
export type Party = "farmer" | "buyer";

/**
 * Which side of a bargain a signed-in account is on.
 *
 * The party must be derived from the session, never accepted from the caller.
 * A request that names its own author is a request that can accept a price on
 * a farmer's behalf.
 *
 * Operations get `null` deliberately: they can read a thread, and they must not
 * be able to speak in one. A price nobody at the platform can quietly agree to
 * is the reason the thread is worth anything as a record.
 */
export function partyFor(
  negotiation: Negotiation,
  role: string,
  accountId: string | undefined,
): Party | null {
  if (!accountId) return null;
  if (role === "farmer" && accountId === negotiation.farmerId) return "farmer";
  // Franchise and buyer are separate roles holding the same buying account,
  // so both map to the buyer side of a bargain.
  if (
    (role === "buyer" || role === "franchise") &&
    accountId === negotiation.buyerId
  ) {
    return "buyer";
  }
  return null;
}

export const PARTY_LABELS: Record<Party, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
};

export type NegotiationStatus =
  | "open"
  /** Both sides settled. Terminal, and the order is created from it. */
  | "agreed"
  /** One side walked away. Terminal. */
  | "withdrawn"
  /** Nobody moved before the listing aged out. Terminal. */
  | "expired";

export type MessageKind = "note" | "proposal" | "accept" | "withdraw";

export interface NegotiationMessage {
  readonly id: string;
  readonly author: Party;
  readonly kind: MessageKind;
  /**
   * Which phrase was sent, from the fixed vocabulary.
   *
   * The message itself is not stored as words either side chose. It is an id,
   * rendered into whatever language the reader uses — see
   * `lib/domain/bargain-vocabulary.ts` for why a bargain is not free text.
   */
  readonly phraseId?: string;
  /**
   * The phrase in English, denormalised so a thread read back years later —
   * exported, disputed, produced as a record — is legible without the
   * vocabulary table to hand. Never client-supplied.
   */
  readonly text?: string;
  /**
   * Locale the sender was reading in. Kept for the record only: the text
   * renders from `phraseId` in whatever language the reader wants, so this no
   * longer decides anything about display.
   */
  readonly locale?: string;
  /** Best grade first. Present on `proposal` and on the `accept` that took it. */
  readonly bands?: readonly GradeBand[];
  /** Proposals go stale — a price quoted this morning is not on tonight. */
  readonly expiresAt?: Date;
  readonly sentAt: Date;
}

export interface Negotiation {
  readonly id: string;
  readonly listingId: string;
  readonly produceName: string;
  /** Account ids, so a session can be matched to a side. Names are for display. */
  readonly farmerId: string;
  readonly buyerId: string;
  readonly farmerName: string;
  readonly buyerName: string;
  readonly quantity: number;
  readonly unit: QuantityUnit;
  readonly status: NegotiationStatus;
  /** Oldest first. Append-only. */
  readonly messages: readonly NegotiationMessage[];
  readonly openedAt: Date;
  /** Set once, when an accept lands. */
  readonly agreedBands?: readonly GradeBand[];
  readonly agreedAt?: Date;
}

/* -------------------------------------------------------------------------
   Reading the thread
   ------------------------------------------------------------------------- */

export function isSettled(negotiation: Negotiation): boolean {
  return negotiation.status !== "open";
}

/** The proposal currently on the table, if any. */
export function standingProposal(
  negotiation: Negotiation,
): NegotiationMessage | undefined {
  for (let i = negotiation.messages.length - 1; i >= 0; i -= 1) {
    if (negotiation.messages[i].kind === "proposal") return negotiation.messages[i];
  }
  return undefined;
}

/** The last proposal a given party made. What they may not undercut. */
export function lastProposalBy(
  negotiation: Negotiation,
  party: Party,
): NegotiationMessage | undefined {
  for (let i = negotiation.messages.length - 1; i >= 0; i -= 1) {
    const message = negotiation.messages[i];
    if (message.kind === "proposal" && message.author === party) return message;
  }
  return undefined;
}

export function hasExpired(
  message: NegotiationMessage | undefined,
  now: number,
): boolean {
  if (!message?.expiresAt) return false;
  return now >= message.expiresAt.getTime();
}

export function rateFor(
  bands: readonly GradeBand[],
  grade: Grade,
): number | undefined {
  return bands.find((b) => b.grade === grade)?.ratePerUnit;
}

/**
 * The grades a proposal actually prices, best first.
 *
 * Screens kept reaching for grade A and calling it the offer. Grades trade
 * separately — a buyer who wants only the B grade prices B alone — so `rateFor`
 * returns undefined for A, the caller reads it as zero, and the button offers
 * to accept ₹0 for a grade nobody mentioned. Ask what was priced instead of
 * assuming.
 */
export function pricedGrades(bands: readonly GradeBand[]): Grade[] {
  return GRADES.filter((grade) => rateFor(bands, grade) !== undefined);
}

/**
 * How far apart the two sides are, grade by grade, in minor units.
 *
 * Positive means the farmer is asking more than the buyer has offered, which
 * is the normal case. Absent where either side has not priced that grade yet.
 */
export function gap(
  negotiation: Negotiation,
): Partial<Record<Grade, number>> {
  const ask = lastProposalBy(negotiation, "farmer")?.bands;
  const bid = lastProposalBy(negotiation, "buyer")?.bands;
  if (!ask || !bid) return {};

  const result: Partial<Record<Grade, number>> = {};
  for (const grade of GRADES) {
    const a = rateFor(ask, grade);
    const b = rateFor(bid, grade);
    if (a !== undefined && b !== undefined) result[grade] = a - b;
  }
  return result;
}

/** How much of a grade a band is for. Absent means the whole lot, as it always did. */
export function quantityFor(
  negotiation: Negotiation,
  bands: readonly GradeBand[],
  grade: Grade,
): number {
  return bands.find((b) => b.grade === grade)?.quantity ?? negotiation.quantity;
}

/** Is any band on this proposal for less than the whole lot? */
export function isPartial(
  negotiation: Negotiation,
  bands: readonly GradeBand[],
): boolean {
  return bands.some((b) => b.quantity !== undefined && b.quantity < negotiation.quantity);
}

/** What the farmer would be paid at these rates for the quantity bid at `grade`. */
export function valueAt(
  negotiation: Negotiation,
  bands: readonly GradeBand[],
  grade: Grade,
): Money {
  const rate = rateFor(bands, grade);
  if (rate === undefined) return money(0);
  return forQuantity(rate, quantityFor(negotiation, bands, grade));
}

/** Rounds of proposals, for showing how long a bargain has run. */
export function roundCount(negotiation: Negotiation): number {
  return negotiation.messages.filter((m) => m.kind === "proposal").length;
}

/* -------------------------------------------------------------------------
   Guards
   ------------------------------------------------------------------------- */

export type NegotiationRefusalCode =
  | "settled"
  | "incompletePricing"
  | "nonPositiveRate"
  | "gradeOrder"
  | "movedBackwards"
  | "noChange"
  | "nothingToAccept"
  | "ownProposal"
  | "proposalExpired"
  /** Wanted more of a grade than is left unsold. */
  | "exceedsAvailable"
  /** The lot sold between the offer being made and the farmer accepting it. */
  | "soldOut"
  /** A quantity that is not a whole number of units, or is zero. */
  | "badQuantity";

export interface NegotiationRefusal {
  readonly code: NegotiationRefusalCode;
  /** Written to be read by whoever tried it, farmer included. */
  readonly message: string;
}

export type NegotiationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly refusal: NegotiationRefusal };

const ALLOWED: NegotiationResult = { allowed: true };

function refuse(
  code: NegotiationRefusalCode,
  message: string,
): NegotiationResult {
  return { allowed: false, refusal: { code, message } };
}

/**
 * May this party put these rates on the table?
 *
 * Fails closed, like the order guards: a proposal that cannot be fully checked
 * is refused rather than assumed sound. This gate stands between produce and
 * money.
 *
 * `remaining` is what is still unsold on the listing — the posted quantities
 * minus every bargain already agreed against them, which the caller derives
 * with `remainingOn`. Passing it is how a bid for part of a lot is bounded.
 * Omitting it means quantities are not checked here at all, which is right for
 * the one caller that has no listing in hand (a thread read back on its own)
 * and wrong everywhere else — so the write path always passes it.
 */
export function canPropose(
  negotiation: Negotiation,
  party: Party,
  bands: readonly GradeBand[],
  remaining?: readonly { grade: Grade; quantity: number }[],
): NegotiationResult {
  if (isSettled(negotiation)) {
    return refuse("settled", "This bargain is closed. Start a new one.");
  }

  // Quantities, before rates. A bid for four hundred kilos of a lot with two
  // hundred left is refused whatever the price, and saying so first gives the
  // clearer message.
  for (const band of bands) {
    if (band.quantity === undefined) continue;

    if (!Number.isInteger(band.quantity) || band.quantity <= 0) {
      return refuse(
        "badQuantity",
        `Grade ${GRADE_LABELS[band.grade]} needs a whole number of units above zero.`,
      );
    }

    if (band.quantity > negotiation.quantity) {
      return refuse(
        "exceedsAvailable",
        `This lot is ${negotiation.quantity} in total. You cannot bid for more than that.`,
      );
    }

    if (remaining) {
      const left = remaining.find((r) => r.grade === band.grade)?.quantity ?? 0;
      if (band.quantity > left) {
        // Says what is available and stops. Whether the rest was never offered
        // or has just been taken by somebody else is not something this can
        // tell from `remaining` alone, and guessing at it out loud would put a
        // sentence in front of a buyer that is sometimes simply false.
        return refuse(
          "exceedsAvailable",
          left === 0
            ? `Nothing is available at grade ${GRADE_LABELS[band.grade]} on this lot.`
            : `Only ${left} available at grade ${GRADE_LABELS[band.grade]}.`,
        );
      }
    }
  }

  // Any subset of grades, so long as it is not empty.
  //
  // Grades are traded separately: a buyer who wants only the top grade bids on
  // grade A alone, and the rest of the lot is simply not part of that deal.
  // What each priced grade still guarantees is that grading at the farm gate
  // resolves the price rather than reopening it — for the grades in the deal.
  const priced = GRADES.filter((grade) => rateFor(bands, grade) !== undefined);

  if (priced.length === 0) {
    return refuse(
      "incompletePricing",
      "Price at least one grade. You can bid on a single grade — you do not have to price all three.",
    );
  }

  for (const grade of priced) {
    const rate = rateFor(bands, grade)!;
    if (!Number.isFinite(rate) || rate <= 0) {
      return refuse(
        "nonPositiveRate",
        `Grade ${GRADE_LABELS[grade]} needs a rate above zero.`,
      );
    }
  }

  // A better grade cannot be worth less than a worse one. Compared only across
  // the grades actually priced, since a gap between them is now legitimate —
  // pricing A and C but not B says nothing about B.
  for (let i = 1; i < priced.length; i += 1) {
    const better = rateFor(bands, priced[i - 1])!;
    const worse = rateFor(bands, priced[i])!;
    if (worse > better) {
      return refuse(
        "gradeOrder",
        `Grade ${GRADE_LABELS[priced[i]]} cannot be priced above grade ${GRADE_LABELS[priced[i - 1]]}. Check the figures.`,
      );
    }
  }

  const previous = lastProposalBy(negotiation, party);
  if (previous?.bands) {
    let moved = false;

    for (const grade of GRADES) {
      const now = rateFor(bands, grade);
      const before = rateFor(previous.bands, grade);

      // Dropping a grade you previously priced is a change, not a retreat —
      // narrowing to "actually, just your grade A" is a legitimate move.
      if (now === undefined) {
        if (before !== undefined) moved = true;
        continue;
      }
      if (before === undefined) {
        moved = true;
        continue;
      }
      if (now !== before) moved = true;

      // Changing how much you want is a move even at the same rate — "the same
      // price, but I'll take twice as much" is a real counter-offer and must
      // not be refused as a repeat.
      const wantNow = bands.find((b) => b.grade === grade)?.quantity;
      const wantBefore = previous.bands.find((b) => b.grade === grade)?.quantity;
      if (wantNow !== wantBefore) moved = true;

      // A buyer only ever improves upward, a farmer only ever concedes
      // downward. Anything else is a party walking back an offer the other
      // side is still considering.
      const backwards = party === "buyer" ? now < before : now > before;
      if (backwards) {
        return refuse(
          "movedBackwards",
          party === "buyer"
            ? `You already offered ₹${(before / 100).toFixed(2)} for grade ${GRADE_LABELS[grade]}. An offer cannot be lowered once it has been made.`
            : `You already asked ₹${(before / 100).toFixed(2)} for grade ${GRADE_LABELS[grade]}. An asking price cannot be raised once it has been given.`,
        );
      }
    }

    if (!moved) {
      return refuse(
        "noChange",
        "These are the same rates you last sent. Change one, or accept what is on the table.",
      );
    }
  }

  return ALLOWED;
}

/**
 * May this party accept what is on the table?
 *
 * The proposal has to exist, be someone else's, and still be live.
 */
export function canAccept(
  negotiation: Negotiation,
  party: Party,
  now: number,
): NegotiationResult {
  if (isSettled(negotiation)) {
    return refuse("settled", "This bargain is already closed.");
  }

  const proposal = standingProposal(negotiation);
  if (!proposal) {
    return refuse(
      "nothingToAccept",
      "No rates have been put forward yet. Send a price first.",
    );
  }

  if (proposal.author === party) {
    return refuse(
      "ownProposal",
      "You cannot accept your own price. Wait for the other side.",
    );
  }

  if (hasExpired(proposal, now)) {
    return refuse(
      "proposalExpired",
      "That price has expired. Ask for it again, or send your own.",
    );
  }

  return ALLOWED;
}

export class NegotiationError extends Error {
  readonly code: NegotiationRefusalCode;

  constructor(refusal: NegotiationRefusal) {
    super(refusal.message);
    this.name = "NegotiationError";
    this.code = refusal.code;
  }
}

/* -------------------------------------------------------------------------
   Applying a message
   ------------------------------------------------------------------------- */

export interface DraftMessage {
  readonly id: string;
  readonly author: Party;
  readonly kind: MessageKind;
  readonly phraseId?: string;
  /** Resolved from `phraseId` by the caller, never taken from a request body. */
  readonly text?: string;
  readonly locale?: string;
  readonly bands?: readonly GradeBand[];
  /** Minutes the proposal stays live. Ignored on other kinds. */
  readonly validForMinutes?: number;
  readonly sentAt: Date;
}

/**
 * Append a message, returning the new negotiation.
 *
 * Throws rather than returning a failure, because every caller has already had
 * the chance to ask `canPropose` / `canAccept` and render the reason. Reaching
 * here with an illegal message is a bug, not a user mistake.
 *
 * An `accept` copies the accepted rates onto the negotiation itself. The thread
 * is the record of how the price was reached; `agreedBands` is the answer, and
 * the order is created from it without re-reading the argument.
 */
export function applyMessage(
  negotiation: Negotiation,
  draft: DraftMessage,
  /** What is still unsold on the listing. See `canPropose`. */
  remaining?: readonly { grade: Grade; quantity: number }[],
): Negotiation {
  const now = draft.sentAt.getTime();

  switch (draft.kind) {
    case "proposal": {
      const bands = draft.bands ?? [];
      const check = canPropose(negotiation, draft.author, bands, remaining);
      if (!check.allowed) throw new NegotiationError(check.refusal);

      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "proposal",
        phraseId: draft.phraseId,
        text: draft.text,
        locale: draft.locale,
        bands,
        expiresAt: draft.validForMinutes
          ? new Date(now + draft.validForMinutes * 60_000)
          : undefined,
        sentAt: draft.sentAt,
      };

      return { ...negotiation, messages: [...negotiation.messages, message] };
    }

    case "accept": {
      const check = canAccept(negotiation, draft.author, now);
      if (!check.allowed) throw new NegotiationError(check.refusal);

      const proposal = standingProposal(negotiation)!;

      /*
        The lot may have gone while this screen was open.

        A bid is checked against what remains when it is *made*; accepting was
        not, so a farmer with a bargain open could agree a price for produce
        another buyer had already taken — a binding commitment against stock
        that is not there. The check has to happen at the accept, because that
        is the moment something becomes owed.

        Only when the caller supplies the remainder. `applyMessage` is used by
        tests and by the offline path with nothing to compare against, and
        refusing every accept for want of an argument would be worse than the
        bug.
      */
      if (remaining) {
        const left = (grade: Grade) =>
          remaining.find((r) => r.grade === grade)?.quantity ?? 0;

        const short = (proposal.bands ?? []).filter(
          (band) => (band.quantity ?? 0) > left(band.grade),
        );

        if (short.length > 0) {
          /*
            Gone entirely, or merely not enough — two different sentences,
            because they call for two different things from the farmer.

            The test for "gone" is that nothing at all remains of what was
            offered on, not that every band is short: an offer naming one grade
            has every band short the moment that grade runs low, and telling
            somebody the lot has sold when 200 of 500 kilos are sitting there
            would be wrong.
          */
          const nothingLeft = short.every((band) => left(band.grade) === 0);

          throw new NegotiationError({
            code: "soldOut",
            message: nothingLeft
              ? "This lot has sold since the offer was made. Nothing is left to agree."
              : `Only part of this is still available — grade ${short
                  .map((b) => b.grade.toUpperCase())
                  .join(", ")} has less left than was offered on. Ask for a fresh offer.`,
          });
        }
      }

      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "accept",
        phraseId: draft.phraseId,
        text: draft.text,
        locale: draft.locale,
        // Snapshot, not a pointer. What was agreed must stay readable even if
        // the thread is later truncated.
        bands: proposal.bands,
        sentAt: draft.sentAt,
      };

      return {
        ...negotiation,
        status: "agreed",
        messages: [...negotiation.messages, message],
        agreedBands: proposal.bands,
        agreedAt: draft.sentAt,
      };
    }

    case "withdraw": {
      if (isSettled(negotiation)) {
        throw new NegotiationError({
          code: "settled",
          message: "This bargain is already closed.",
        });
      }

      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "withdraw",
        phraseId: draft.phraseId,
        text: draft.text,
        locale: draft.locale,
        sentAt: draft.sentAt,
      };

      return {
        ...negotiation,
        status: "withdrawn",
        messages: [...negotiation.messages, message],
      };
    }

    case "note": {
      if (isSettled(negotiation)) {
        throw new NegotiationError({
          code: "settled",
          message: "This bargain is closed.",
        });
      }

      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "note",
        phraseId: draft.phraseId,
        text: draft.text,
        locale: draft.locale,
        sentAt: draft.sentAt,
      };

      return { ...negotiation, messages: [...negotiation.messages, message] };
    }
  }
}

/**
 * Close a thread nobody moved on.
 *
 * Separate from `withdraw` because no one chose it — the UI must not tell a
 * farmer the buyer walked away when in fact the listing simply aged out.
 */
export function expire(negotiation: Negotiation): Negotiation {
  if (isSettled(negotiation)) return negotiation;
  return { ...negotiation, status: "expired" };
}
