import type { Role } from "@/lib/auth/claims";

/**
 * A record of who changed what, kept because somebody will eventually ask.
 *
 * ## What this is for
 *
 * Bug 13: a quantity was edited and a price was changed and nobody could say
 * by whom, from what, or when. On a platform where the argument is that a
 * farmer and a buyer settle a price between themselves, "the number is
 * different from what I remember" has to be answerable — and answerable with
 * a record neither side wrote.
 *
 * ## Immutable means immutable
 *
 * An audit log that can be edited is a log that proves nothing, so this is
 * append-only in three places at once and not just by convention:
 *
 *  - Nothing here exposes an update or a delete. The only verb is `record`.
 *  - `firestore.rules` denies write to every client and read to everyone but
 *    operations and the actor themselves.
 *  - The document id is derived from the event, so replaying the same write
 *    twice overwrites an identical row instead of appending a duplicate.
 *
 * The Admin SDK bypasses Security Rules, so the rules are the backstop and
 * this module is the mechanism — which is why there is no `deleteEntry` here
 * for anybody to reach for.
 *
 * ## What is worth recording
 *
 * Material changes only: quantity, price, verification standing, a bargain
 * settled or withdrawn, a listing pulled. Not page views, not sign-ins, not
 * every keystroke — a log nobody can read through is one nobody reads, and the
 * question this answers is always about a specific listing or a specific
 * account.
 */

export const AUDIT_ACTIONS = [
  "listing.created",
  "listing.quantityChanged",
  "listing.priceChanged",
  "listing.withdrawn",
  "bargain.proposed",
  "bargain.agreed",
  "bargain.withdrawn",
  "order.placed",
  "order.cancelled",
  "account.statusChanged",
  "account.documentReviewed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

/** Said the way somebody reading a history page would say it. */
export const AUDIT_LABELS: Record<AuditAction, string> = {
  "listing.created": "Listed produce",
  "listing.quantityChanged": "Changed the quantity",
  "listing.priceChanged": "Changed the price",
  "listing.withdrawn": "Withdrew the listing",
  "bargain.proposed": "Proposed a price",
  "bargain.agreed": "Agreed a price",
  "bargain.withdrawn": "Ended the bargain",
  "order.placed": "Placed an order",
  "order.cancelled": "Cancelled the order",
  "account.statusChanged": "Changed an account's standing",
  "account.documentReviewed": "Reviewed a document",
};

export interface AuditActor {
  /** The account that acted, or `undefined` for operations, who are not one. */
  readonly accountId?: string;
  readonly role: Role;
  /** For display. Denormalised, so a name change does not rewrite history. */
  readonly name: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly actor: AuditActor;
  /**
   * What was acted on — a listing id, a bargain id, an account id.
   *
   * Both parts are needed: filtering "everything that happened to listing
   * L-42" is the question this page exists to answer, and an id alone does not
   * say which collection it is in.
   */
  readonly subject: { readonly kind: string; readonly id: string };
  /**
   * Before and after, where the action changed a value.
   *
   * Strings rather than numbers, because a price and a quantity and a status
   * all pass through here and the history page renders them as written. The
   * caller formats; this stores.
   */
  readonly from?: string;
  readonly to?: string;
  /** One line of context, where the values alone do not explain it. */
  readonly note?: string;
  readonly at: Date;
}

/**
 * The id for one event, derived rather than random.
 *
 * A cron retry, a double-submitted form or an operator pressing a button twice
 * would otherwise append the same change two or three times, and a history
 * that shows one edit as three is worse than no history — somebody will read
 * it as three edits.
 *
 * The timestamp is part of the key at second resolution: the same actor making
 * the same change to the same thing twice in one second is a duplicate write;
 * a minute later it is a second, real edit.
 */
export function auditKey(entry: Omit<AuditEntry, "id">): string {
  const second = Math.floor(entry.at.getTime() / 1000);
  return [
    entry.subject.kind,
    entry.subject.id,
    entry.action,
    entry.actor.accountId ?? entry.actor.role,
    second,
  ].join("_");
}

/** Who may read a given entry. Operations see everything; you see your own. */
export function mayReadAudit(
  entry: Pick<AuditEntry, "actor" | "subject">,
  reader: { role: Role; accountId?: string },
): boolean {
  if (reader.role === "admin") return true;
  if (!reader.accountId) return false;

  // Your own actions, and anything done to a record that is yours. The second
  // half is the important one: a farmer needs to see that operations changed
  // their listing's quantity, which is not an action they took.
  return (
    entry.actor.accountId === reader.accountId || entry.subject.id === reader.accountId
  );
}

/** Newest first. What a history page always wants. */
export function newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface AuditFilter {
  readonly action?: AuditAction;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly since?: Date;
  readonly until?: Date;
}

/**
 * The report asked for filtering by user, listing, action type and date.
 *
 * Done here rather than as a Firestore query because the four combine freely,
 * and a composite index per combination is sixteen indexes for a page read a
 * few times a week. The collection is read scoped to one subject or one actor
 * first; this narrows what came back.
 */
export function matches(entry: AuditEntry, filter: AuditFilter): boolean {
  if (filter.action && entry.action !== filter.action) return false;
  if (filter.actorId && entry.actor.accountId !== filter.actorId) return false;
  if (filter.subjectId && entry.subject.id !== filter.subjectId) return false;
  if (filter.since && entry.at.getTime() < filter.since.getTime()) return false;
  // Inclusive of the whole `until` day is the caller's business — this is a
  // plain bound, and a page passing end-of-day is doing the right thing.
  if (filter.until && entry.at.getTime() > filter.until.getTime()) return false;
  return true;
}
