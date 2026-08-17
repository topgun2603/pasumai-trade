import "server-only";

import type { NotificationAudience, NotificationKind } from "@/lib/domain/notification";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Writing notifications from the application.
 *
 * The route handlers do this the moment a write lands, so the bell is current
 * before the page has finished reloading — no waiting on a trigger in another
 * continent. The Firestore triggers still run and still write; they share the
 * id scheme in `lib/domain/notification-key.ts`, so whichever arrives second
 * collides and is dropped rather than duplicating the row.
 *
 * Never throws into the caller. A notification is a courtesy on top of the
 * thing that actually happened — a farmer's price is agreed whether or not the
 * bell updates, and failing the accept because the bell could not be written
 * would be the tail wagging the dog.
 */

export interface NotificationDraft {
  /** Deterministic — see `lib/domain/notification-key.ts`. */
  readonly id: string;
  readonly accountId: string;
  readonly audience: NotificationAudience;
  readonly kind: NotificationKind;
  readonly subject: Record<string, string | number | undefined>;
  readonly href: string;
}

/** Firestore rejects `undefined`; a fact nobody had is stored as absent. */
function clean(subject: NotificationDraft["subject"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(subject)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

export async function writeNotifications(
  drafts: readonly NotificationDraft[],
): Promise<void> {
  const rows = drafts.filter((d) => d.accountId && d.id);
  if (rows.length === 0 || !hasAdminCredentials()) return;

  const db = adminDb();
  const now = new Date();

  await Promise.all(
    rows.map(async (draft) => {
      try {
        await db
          .collection("accounts")
          .doc(draft.accountId)
          .collection("notifications")
          .doc(draft.id)
          // `create`, never `set`. A second writer for the same event must
          // collide — overwriting would resurrect a notification the person had
          // already read.
          .create({
            accountId: draft.accountId,
            audience: draft.audience,
            kind: draft.kind,
            subject: clean(draft.subject),
            href: draft.href,
            createdAt: now,
            readAt: null,
          });
      } catch (error) {
        // ALREADY_EXISTS is the trigger having got there first, which is the
        // design working. Anything else is logged and swallowed.
        if ((error as { code?: number }).code === 6) return;
        console.error("notification not written", { id: draft.id, error });
      }
    }),
  );
}
