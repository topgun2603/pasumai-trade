import { getFirestore, FieldValue, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

/**
 * Writing notifications, once.
 *
 * Firestore events are delivered **at least once** and in no guaranteed order.
 * A single write can therefore invoke a trigger twice, and a farmer seeing "a
 * buyer opened a bargain" twice for one bargain is the platform looking broken.
 *
 * The fix is the documented one: the event id is stable across redeliveries, so
 * it becomes part of the document id. A second delivery writes the same
 * document at the same path, and Firestore's `create` refuses it — which is
 * exactly what we want, and cheaper than reading first.
 *
 * `${eventId}-${accountId}` rather than the event id alone, because one event
 * legitimately fans out to several people: a bargain agreed notifies both
 * sides, and a lot listed notifies every buyer covering the district.
 *
 * They live under `accounts/{accountId}/notifications`, not in one flat
 * collection, and that is a security decision before it is a performance one.
 * The account is the *path*, so a rule matching it cannot be widened by a
 * cleverer query — where a flat collection would be scoped by comparing a
 * field, and a `list` that forgot the filter would return the whole platform's
 * business. It also means the ordinary read — one account's rows, newest first
 * — needs no composite index, because there is only one field left to sort on.
 */

export type Audience = "farmer" | "buyer";

export interface Draft {
  readonly accountId: string;
  readonly audience: Audience;
  readonly kind: string;
  readonly subject: Record<string, string | number | undefined>;
  readonly href: string;
}

/** Firestore rejects `undefined`; a fact nobody had is stored as absent. */
function clean(subject: Draft["subject"]): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(subject)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

/**
 * Write a batch of notifications for one event.
 *
 * Every row is `create`, never `set`, so a redelivery collides instead of
 * overwriting — overwriting would resurrect a notification the person had
 * already read, which is worse than a duplicate.
 */
export async function notify(
  eventId: string,
  drafts: readonly Draft[],
): Promise<void> {
  const rows = drafts.filter((d) => d.accountId);
  if (rows.length === 0) return;

  const db = getFirestore();

  // Committed one at a time rather than in a batch: a batch fails whole, so a
  // single duplicate — the ordinary case on a redelivery — would drop the
  // notifications for everybody else in it.
  const writes = rows.map(async (draft) => {
    const id = `${eventId}-${draft.accountId}`;
    try {
      await db
        .collection("accounts")
        .doc(draft.accountId)
        .collection("notifications")
        .doc(id)
        .create({
          // Denormalised alongside the path. The path is what secures it; this
          // is what lets an operations query across the collection group say
          // whose row it found without parsing a document reference.
          accountId: draft.accountId,
          audience: draft.audience,
          kind: draft.kind,
          subject: clean(draft.subject),
          href: draft.href,
          createdAt: FieldValue.serverTimestamp(),
          // Explicit null rather than absent, so "unread" is a value the query
          // can filter on rather than the absence of a field.
          readAt: null,
          eventId,
        });
    } catch (error) {
      // ALREADY_EXISTS is the redelivery we designed for, and is not a
      // problem. Anything else is.
      if ((error as { code?: number }).code === 6) {
        logger.debug("notification already written", { id });
        return;
      }
      throw error;
    }
  });

  await Promise.all(writes);
  logger.info("notifications written", { eventId, count: rows.length });
}
