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
  /** Free text. Present on a note, optional alongside a proposal. */
  readonly text?: string;
  /**
   * Locale the text was written in, so it renders with the right font and can
   * be offered for translation. A farmer types Tamil; a buyer may not read it.
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

/** What the farmer would be paid at these rates if the lot graded out at `grade`. */
export function valueAt(
  negotiation: Negotiation,
  bands: readonly GradeBand[],
  grade: Grade,
): Money {
  const rate = rateFor(bands, grade);
  if (rate === undefined) return money(0);
  return forQuantity(rate, negotiation.quantity);
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
  | "proposalExpired";

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
 */
export function canPropose(
  negotiation: Negotiation,
  party: Party,
  bands: readonly GradeBand[],
): NegotiationResult {
  if (isSettled(negotiation)) {
    return refuse("settled", "This bargain is closed. Start a new one.");
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
): Negotiation {
  const now = draft.sentAt.getTime();

  switch (draft.kind) {
    case "proposal": {
      const bands = draft.bands ?? [];
      const check = canPropose(negotiation, draft.author, bands);
      if (!check.allowed) throw new NegotiationError(check.refusal);

      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "proposal",
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
      const message: NegotiationMessage = {
        id: draft.id,
        author: draft.author,
        kind: "accept",
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
