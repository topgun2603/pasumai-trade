/**
 * The identity of a notification, derived from what happened.
 *
 * Notifications get written from two places — the route handler that caused the
 * event, and the Firestore trigger watching the document — and both must be
 * able to run without producing two rows. So the document id is not a delivery
 * id but a *description of the event*: same event, same id, whoever writes it
 * first. The second writer's `create` collides and is dropped.
 *
 * That is a stronger guarantee than deduplicating on Eventarc's event id, which
 * only absorbs redeliveries of the same delivery. This absorbs the same fact
 * arriving by a different road.
 *
 * Why two writers at all: the route handler is in Mumbai beside the user and
 * fires the instant the write lands, so the bell is current before the page
 * finishes reloading. The trigger is in us-central1 next to the database and
 * catches anything the routes did not do — a script, an operator editing a
 * document by hand, a path added later by somebody who did not know to notify.
 * Neither alone is both fast and complete.
 */

/** Anything that identifies the event, in order from general to specific. */
export function notificationKey(
  parts: ReadonlyArray<string | number | undefined>,
  accountId: string,
): string {
  const key = parts
    .filter((part) => part !== undefined && part !== "")
    .join("-")
    // Firestore ids may not contain a slash, and a produce name or an agency
    // never belongs in one anyway — these are all ids and counters.
    .replace(/[^A-Za-z0-9_-]+/g, "_");

  return `${key}-${accountId}`;
}

/**
 * A message appended to a bargain.
 *
 * Keyed on how many messages the thread now holds, because that is what both
 * writers can see and it never repeats: messages are append-only, so the count
 * after this message is a permanent name for it.
 */
export function bargainMessageKey(
  negotiationId: string,
  messageCount: number,
  accountId: string,
): string {
  return notificationKey([negotiationId, `m${messageCount}`], accountId);
}

/** Transport arranged on a bargain. Once per bargain — a second attempt is a retry. */
export function transportKey(negotiationId: string, accountId: string): string {
  return notificationKey([negotiationId, "transport"], accountId);
}

/** A lot appearing on the market. Once per listing, per buyer told about it. */
export function listingKey(listingId: string, accountId: string): string {
  return notificationKey([listingId, "listed"], accountId);
}

/** An order placed. Once per order. */
export function orderKey(orderId: string, accountId: string): string {
  return notificationKey([orderId, "ordered"], accountId);
}

/**
 * A decision operations made about one KYC check.
 *
 * Keyed on how many notes the check's trail now holds, for exactly the reason
 * `bargainMessageKey` is keyed on the message count: the trail is append-only,
 * so its length after this decision is a permanent name for it.
 *
 * The obvious key — account, check, resulting state — is what this replaces,
 * and it was silently wrong. Asking a second question about the same check
 * produced the same id, the `create` collided, and the applicant was never
 * told. The operator saw "asked" and nothing happened: no notification, no
 * bell, no push. Twice is not an edge case here; it is what a conversation is.
 */
export function kycDecisionKey(
  accountId: string,
  kind: string,
  noteCount: number,
): string {
  return notificationKey([accountId, "kyc", kind, `n${noteCount}`], accountId);
}
