import "server-only";

import { auditKey, type AuditEntry } from "@/lib/domain/audit";
import { adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Writing to the audit log. The only verb there is.
 *
 * No update, no delete, and deliberately nothing to import that would let a
 * caller reach for one. The Admin SDK bypasses Security Rules, so the rules in
 * `firestore.rules` are a backstop against a client; *this* module is what
 * stops the platform itself from rewriting its own history.
 *
 * ## Never throws
 *
 * An audit write that fails must not fail the thing it was recording. A farmer
 * changing a price and being told it did not work — because a log write timed
 * out — trades a real operation for a bookkeeping one. So this swallows and
 * reports, and a missing row is the cost.
 *
 * That is a real trade and worth naming: it means the log is nearly complete
 * rather than provably complete, and it should never be used as evidence that
 * something did *not* happen. It answers "what happened to this listing",
 * which is the question Bug 13 actually asks.
 */

export async function record(entry: Omit<AuditEntry, "id">): Promise<void> {
  if (!hasAdminCredentials()) return;

  try {
    const id = auditKey(entry);

    // `set`, not `add`. The id is derived from the event, so a retry writes the
    // same row again rather than appending a second one — see `auditKey`.
    await adminDb()
      .collection("audit")
      .doc(id)
      .set({
        action: entry.action,
        actorId: entry.actor.accountId ?? null,
        actorRole: entry.actor.role,
        actorName: entry.actor.name,
        subjectKind: entry.subject.kind,
        subjectId: entry.subject.id,
        from: entry.from ?? null,
        to: entry.to ?? null,
        note: entry.note ?? null,
        at: entry.at,
      });
  } catch (error) {
    // Logged, not raised. See the note above.
    console.error("audit write failed", {
      action: entry.action,
      subject: entry.subject,
      error,
    });
  }
}
