import "server-only";

import type { Role } from "@/lib/auth/claims";
import type { Check, CheckKind, CheckMethod, CheckState } from "@/lib/domain/kyc";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";

import { adminDb } from "./admin";

/**
 * KYC checks live on the account document, under `kyc`.
 *
 * Same reasoning as the subscription: every guard that needs them has already
 * loaded the account, and a separate collection would be a second read on the
 * hot path.
 */

const KINDS: CheckKind[] = ["identity", "pan", "gst", "bank", "fssai"];
const STATES: CheckState[] = ["notStarted", "pending", "verified", "review", "failed"];

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

export function shapeChecks(raw: unknown): Check[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): Check[] => {
    if (!entry || typeof entry !== "object") return [];
    const d = entry as Record<string, unknown>;

    if (!KINDS.includes(d.kind as CheckKind)) return [];
    // An unreadable state is dropped rather than defaulted. Defaulting to
    // `verified` would be catastrophic and defaulting to `notStarted` would
    // silently lose somebody's submission — neither is better than treating
    // the record as absent, which the flow already handles.
    if (!STATES.includes(d.state as CheckState)) return [];

    return [
      {
        kind: d.kind as CheckKind,
        method: d.method === "ekyc" ? "ekyc" : ("manual" as CheckMethod),
        state: d.state as CheckState,
        reference: typeof d.reference === "string" ? d.reference : undefined,
        verifiedName: typeof d.verifiedName === "string" ? d.verifiedName : undefined,
        approvedBy: typeof d.approvedBy === "string" ? d.approvedBy : undefined,
        reason: typeof d.reason === "string" ? d.reason : undefined,
        checkedAt: toDate(d.checkedAt),
      },
    ];
  });
}

/** Firestore wants plain values; `undefined` is rejected outright. */
export function serialiseChecks(checks: readonly Check[]): Record<string, unknown>[] {
  return checks.map((c) => ({
    kind: c.kind,
    method: c.method,
    state: c.state,
    reference: c.reference ?? null,
    verifiedName: c.verifiedName ?? null,
    approvedBy: c.approvedBy ?? null,
    reason: c.reason ?? null,
    checkedAt: c.checkedAt ?? null,
  }));
}

export async function readChecks(role: Role, accountId: string | undefined): Promise<Check[]> {
  if (!accountId || !canSelfSignup(role)) return [];
  const snapshot = await adminDb()
    .collection(COLLECTION_FOR_SIGNUP[role])
    .doc(accountId)
    .get();
  if (!snapshot.exists) return [];
  return shapeChecks(snapshot.data()!.kyc);
}

export interface PendingReview {
  readonly accountId: string;
  readonly role: Role;
  readonly collection: string;
  readonly name: string;
  readonly mobile: string;
  readonly district: string;
  readonly checks: Check[];
  readonly submittedAt?: Date;
}

/**
 * Everything waiting on operations, across every kind of account.
 *
 * Three reads rather than a collection group query: the accounts live in three
 * collections with no shared parent, and a collection group needs an index per
 * field which is more moving parts than a queue this size justifies.
 */
export async function readReviewQueue(): Promise<PendingReview[]> {
  const db = adminDb();
  const sources: Array<{ collection: string; roles: Role[] }> = [
    { collection: "farmers", roles: ["farmer"] },
    { collection: "buyers", roles: ["buyer", "franchise"] },
    { collection: "agencies", roles: ["transport", "manpower"] },
  ];

  const queue: PendingReview[] = [];

  for (const source of sources) {
    const snapshot = await db.collection(source.collection).get();

    for (const doc of snapshot.docs) {
      const checks = shapeChecks(doc.data().kyc);
      const waiting = checks.filter((c) => c.state === "review");
      if (waiting.length === 0) continue;

      const data = doc.data();
      // An agency's role is not stored on the document — a transport and a
      // manpower agency are the same record. The first role of the collection
      // is used for display; approval takes the role from the request, which
      // only changes which collection is written to, and both map to the same
      // one here.
      queue.push({
        accountId: doc.id,
        role: source.roles[0],
        collection: source.collection,
        name: typeof data.name === "string" ? data.name : doc.id,
        mobile: typeof data.mobile === "string" ? data.mobile : "",
        district: typeof data.district === "string" ? data.district : "",
        checks,
        submittedAt: waiting
          .map((c) => c.checkedAt)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => a.getTime() - b.getTime())[0],
      });
    }
  }

  // Oldest first. A review queue sorted newest-first is how the person who has
  // waited longest keeps waiting.
  return queue.sort(
    (a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0),
  );
}
