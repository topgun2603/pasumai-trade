import "server-only";

import { cache } from "react";

import { isAuditAction, newestFirst, type AuditEntry } from "@/lib/domain/audit";
import { adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Reading the history of one thing, or of one person's actions.
 *
 * Always scoped. There is no "read the whole audit log" here, because on a
 * platform of any size that is a page that never finishes loading and, more to
 * the point, is not a question anybody has — the questions are "what happened
 * to this listing" and "what has this account done".
 */

function shape(id: string, d: Record<string, unknown>): AuditEntry | null {
  if (!isAuditAction(d.action)) return null;

  const at =
    d.at && typeof d.at === "object" && "toDate" in d.at
      ? (d.at as { toDate(): Date }).toDate()
      : null;
  if (!at) return null;

  return {
    id,
    action: d.action,
    actor: {
      accountId: typeof d.actorId === "string" ? d.actorId : undefined,
      // Anything unrecognised is treated as operations rather than dropped: a
      // row with an odd role is still a row somebody may need to see.
      role: (typeof d.actorRole === "string" ? d.actorRole : "admin") as AuditEntry["actor"]["role"],
      name: typeof d.actorName === "string" ? d.actorName : "Unknown",
    },
    subject: {
      kind: typeof d.subjectKind === "string" ? d.subjectKind : "",
      id: typeof d.subjectId === "string" ? d.subjectId : "",
    },
    parties: Array.isArray(d.parties)
      ? d.parties.filter((p): p is string => typeof p === "string")
      : undefined,
    from: typeof d.from === "string" ? d.from : undefined,
    to: typeof d.to === "string" ? d.to : undefined,
    note: typeof d.note === "string" ? d.note : undefined,
    at,
  };
}

/** Enough to answer the question, few enough to render. */
const LIMIT = 200;

/** Everything that happened to one listing, account or bargain. */
export const readSubjectHistory = cache(async function readSubjectHistory(
  subjectId: string,
): Promise<AuditEntry[]> {
  if (!subjectId || !hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection("audit")
      .where("subjectId", "==", subjectId)
      .limit(LIMIT)
      .get();

    // Sorted here rather than with `orderBy`, which would need a composite
    // index per filter combination and would silently drop any row written
    // before `at` existed.
    return newestFirst(
      snapshot.docs.map((doc) => shape(doc.id, doc.data())).filter((e) => e !== null),
    );
  } catch {
    return [];
  }
});

/** Everything one account has done. */
export const readActorHistory = cache(async function readActorHistory(
  actorId: string,
): Promise<AuditEntry[]> {
  if (!actorId || !hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection("audit")
      .where("actorId", "==", actorId)
      .limit(LIMIT)
      .get();

    return newestFirst(
      snapshot.docs.map((doc) => shape(doc.id, doc.data())).filter((e) => e !== null),
    );
  } catch {
    return [];
  }
});

/**
 * Everything one account was a party to.
 *
 * The third read a history page needs. `subjectId` covers things done *to*
 * somebody's record and `actorId` covers what they did; neither covers a
 * bargain, whose subject is the thread and whose actor is whichever side spoke
 * — so without this the log records the most consequential thing on the
 * platform and shows it to nobody.
 */
export const readPartyHistory = cache(async function readPartyHistory(
  accountId: string,
): Promise<AuditEntry[]> {
  if (!accountId || !hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection("audit")
      .where("parties", "array-contains", accountId)
      .limit(LIMIT)
      .get();

    return newestFirst(
      snapshot.docs.map((doc) => shape(doc.id, doc.data())).filter((e) => e !== null),
    );
  } catch {
    return [];
  }
});
