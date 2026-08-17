import type { NotificationAudience, NotificationKind } from "./notification";

/**
 * Who gets told what, as plain data in and plain data out.
 *
 * Deliberately separate from the triggers. Deciding that an accepted bargain
 * notifies both sides while a counter-offer notifies only the other one is a
 * *rule*, and rules on this platform live where they can be tested — the same
 * argument that keeps the order guards and the bargaining guards out of the
 * route handlers. What is left in `index.ts` is the adapter: read the event,
 * fetch what the rule needs, write what it returns.
 *
 * Nothing here touches Firestore or knows what a snapshot is. It takes the
 * document shapes both writers already hold and returns the notifications they
 * should write — so the route handler in Mumbai and the trigger in us-central1
 * apply one rule rather than two that drift.
 *
 * Deliberately importing nothing but types: the functions package compiles this
 * file into its own bundle, where `server-only` and the `@/` alias do not
 * exist.
 */

/** A notification about to be written, before it has an id. */
export interface Draft {
  readonly accountId: string;
  readonly audience: NotificationAudience;
  readonly kind: NotificationKind;
  readonly subject: Record<string, string | number | undefined>;
  readonly href: string;
}

/** A Firestore document, as far as this module is concerned. */
type Doc = Record<string, unknown>;

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value ? value : fallback;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

interface Message {
  readonly author?: string;
  readonly kind?: string;
}

function messages(doc: Doc | undefined): Message[] {
  return Array.isArray(doc?.messages) ? (doc.messages as Message[]) : [];
}

/* -------------------------------------------------------------------------
   New produce
   ------------------------------------------------------------------------- */

/**
 * A lot was posted; the buyers who cover that district hear about it.
 *
 * Fanned out by district rather than to everybody. A buyer three hundred
 * kilometres away cannot collect it, and a list full of lots they cannot buy is
 * a list they stop reading — at which point the notifications that matter are
 * lost with the rest.
 */
export function forListing(input: {
  listing: Doc;
  listingId: string;
  farmerName: string;
  /** Buyer account ids covering the listing's district. */
  buyerIds: readonly string[];
}): Draft[] {
  const { listing, listingId, farmerName, buyerIds } = input;

  // Demo rows exist to make the consoles look inhabited. Telling real buyers
  // about them would be the platform lying about its own market.
  if (listing.seeded === true) return [];
  if (listing.status === "withdrawn" || listing.status === "expired") return [];

  return buyerIds.map((accountId) => ({
    accountId,
    audience: "buyer" as const,
    kind: "produceListed",
    subject: {
      produceName: str(listing.produceName),
      quantity: num(listing.quantity),
      unit: str(listing.unit),
      counterparty: farmerName || "A farmer",
      listingId,
    },
    // To the market rather than to the single lot: the row is there, and a
    // buyer who lands on one listing has nowhere to go next.
    href: "/listings",
  }));
}

/* -------------------------------------------------------------------------
   Bargaining
   ------------------------------------------------------------------------- */

/**
 * Everything that happens inside a bargain, from one document change.
 *
 * Driven off the message that was appended rather than off the status field.
 * The status is a consequence; the message is the act, it says who performed
 * it, and it is what the other side is being told about. Accepting does both at
 * once, which is exactly why reading the status too would notify twice.
 */
export function forBargain(input: {
  before: Doc | undefined;
  after: Doc | undefined;
  negotiationId: string;
}): Draft[] {
  const { before, after, negotiationId } = input;

  // Deleted. Nothing to say, and saying it would point at a gap.
  if (!after) return [];

  const farmerId = str(after.farmerId);
  const buyerId = str(after.buyerId);
  const farmerName = str(after.farmerName, "The farmer");
  const buyerName = str(after.buyerName, "The buyer");
  const produceName = str(after.produceName);
  const unit = str(after.unit);

  const drafts: Draft[] = [];

  /* Transport, which is not a message ------------------------------------- */

  const transport = after.transport as Doc | undefined;

  if (!before?.transport && transport) {
    const subject = {
      produceName,
      quantity: num(transport.quantity),
      unit: str(transport.unit) || unit,
      agencyName: str(transport.agencyName),
      negotiationId,
    };

    // The buyer is the one waiting to hear a vehicle is coming. The farmer
    // arranged it and already knows — told anyway, because the request is
    // theirs to cancel and the record belongs in both lists.
    drafts.push(
      { accountId: buyerId, audience: "buyer", kind: "transportArranged", subject, href: "/bargains" },
      { accountId: farmerId, audience: "farmer", kind: "transportArranged", subject, href: "/farm/sales" },
    );
  }

  /* Whatever was said ------------------------------------------------------ */

  const had = messages(before).length;
  const now = messages(after);

  if (now.length > had) {
    const latest = now[now.length - 1];
    const fromFarmer = latest?.author === "farmer";

    const author = fromFarmer ? farmerName : buyerName;
    const otherId = fromFarmer ? buyerId : farmerId;
    const otherSide = fromFarmer ? ("buyer" as const) : ("farmer" as const);

    const subject = {
      produceName,
      unit,
      counterparty: author,
      negotiationId,
      quantity: num(after.quantity),
    };

    const inbox = (audience: "farmer" | "buyer") =>
      audience === "farmer" ? "/farm/bargains" : "/bargains";

    switch (latest?.kind) {
      case "proposal":
        drafts.push({
          accountId: otherId,
          audience: otherSide,
          // The first proposal on a thread is the bargain being opened, which
          // is a different thing to hear about than a counter-offer.
          kind: had === 0 ? "bargainOpened" : "bargainCountered",
          subject,
          href: inbox(otherSide),
        });
        break;

      case "note":
        drafts.push({
          accountId: otherId,
          audience: otherSide,
          kind: "bargainMessage",
          subject,
          href: inbox(otherSide),
        });
        break;

      case "accept":
      case "withdraw": {
        // Both sides. A settled bargain is the one message the party who
        // caused it also needs in writing.
        const kind = latest.kind === "accept" ? "bargainAgreed" : "bargainClosed";
        drafts.push(
          {
            accountId: farmerId,
            audience: "farmer",
            kind,
            subject: { ...subject, counterparty: buyerName },
            href: kind === "bargainAgreed" ? "/farm/sales" : "/farm/bargains",
          },
          {
            accountId: buyerId,
            audience: "buyer",
            kind,
            subject: { ...subject, counterparty: farmerName },
            href: "/bargains",
          },
        );
        break;
      }

      default:
        break;
    }
  }

  return drafts;
}

/* -------------------------------------------------------------------------
   Orders
   ------------------------------------------------------------------------- */

/**
 * An order was placed; the farmer is told.
 *
 * The buyer placed it and does not need telling. The farmer is the one whose
 * next morning changes.
 */
export function forOrder(input: { order: Doc; orderId: string }): Draft[] {
  const { order, orderId } = input;
  if (order.seeded === true) return [];

  const farmerId = str(order.farmerId);
  if (!farmerId) return [];

  return [
    {
      accountId: farmerId,
      audience: "farmer",
      kind: "orderPlaced",
      subject: {
        produceName: str(order.produceName),
        quantity: num(order.quantity),
        unit: str(order.unit),
        counterparty: str(order.buyerName, "A buyer"),
        orderId,
      },
      href: "/farm/sales",
    },
  ];
}
