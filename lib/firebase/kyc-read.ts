import "server-only";

import { cache } from "react";

/*
  Read once per request, however many times it is asked for.

  A console page and the layout around it both render in one request, and both
  want the same counts — the admin rail reads the KYC queue for a badge and the
  overview reads it again for a tile. `cache` from React memoises for the life of
  one request, so the second caller gets the first caller's promise instead of a
  second trip to a database on another continent.

  Per request, not across requests: nothing here is stale, and a write followed
  by a fresh render still reads the new value.
*/

import type { Role } from "@/lib/auth/claims";
import type {
  Check,
  CheckKind,
  CheckMethod,
  CheckState,
  KycDocument,
  ReviewNote,
} from "@/lib/domain/kyc";
import { MAX_DOCUMENTS_KEPT, isDocumentType } from "@/lib/domain/kyc";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";

import { adminDb, adminStorage } from "./admin";

/**
 * KYC checks live on the account document, under `kyc`.
 *
 * Same reasoning as the subscription: every guard that needs them has already
 * loaded the account, and a separate collection would be a second read on the
 * hot path.
 */

const KINDS: CheckKind[] = ["identity", "pan", "gst", "bank", "fssai"];
const STATES: CheckState[] = [
  "notStarted",
  "pending",
  "verified",
  "review",
  // Without these two a check sent back to an applicant reads as unreadable on
  // the next load and is dropped — losing the request along with the record of
  // having made it.
  "moreInfo",
  "reupload",
  "failed",
];

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
        verifiedName:
          typeof d.verifiedName === "string" ? d.verifiedName : undefined,
        approvedBy: typeof d.approvedBy === "string" ? d.approvedBy : undefined,
        reason: typeof d.reason === "string" ? d.reason : undefined,
        notes: Array.isArray(d.notes)
          ? d.notes.flatMap((raw): ReviewNote[] => {
              const n = raw as Record<string, unknown>;
              const by = n.by === "applicant" ? "applicant" : "operations";
              if (!STATES.includes(n.state as CheckState)) return [];
              // A note with no readable timestamp cannot be placed in the
              // conversation, and a trail out of order is worse than a short
              // one.
              const at = toDate(n.at);
              if (!at) return [];
              return [
                {
                  at,
                  by,
                  state: n.state as CheckState,
                  operator:
                    typeof n.operator === "string" ? n.operator : undefined,
                  message:
                    typeof n.message === "string" ? n.message : undefined,
                },
              ];
            })
          : undefined,
        documents: shapeDocuments(d.documents),
        checkedAt: toDate(d.checkedAt),
      },
    ];
  });
}

/**
 * The evidence, as stored.
 *
 * A document with no readable path is dropped: it cannot be signed, so it would
 * render as a broken tile in the operator's carousel and be mistaken for a
 * document that failed to load rather than one that was never there.
 */
function shapeDocuments(raw: unknown): KycDocument[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const documents = raw.flatMap((entry): KycDocument[] => {
    if (!entry || typeof entry !== "object") return [];
    const d = entry as Record<string, unknown>;
    const path = typeof d.path === "string" ? d.path : "";
    if (!path) return [];
    return [
      {
        path,
        contentType:
          typeof d.contentType === "string" ? d.contentType : "image/jpeg",
        uploadedAt: toDate(d.uploadedAt) ?? new Date(0),
      },
    ];
  });

  return documents.length > 0
    ? documents.slice(0, MAX_DOCUMENTS_KEPT)
    : undefined;
}

/** Firestore wants plain values; `undefined` is rejected outright. */
export function serialiseChecks(
  checks: readonly Check[],
): Record<string, unknown>[] {
  return checks.map((c) => ({
    kind: c.kind,
    method: c.method,
    state: c.state,
    reference: c.reference ?? null,
    verifiedName: c.verifiedName ?? null,
    approvedBy: c.approvedBy ?? null,
    reason: c.reason ?? null,
    checkedAt: c.checkedAt ?? null,
    // The trail, or the conversation is lost on the next write and a queue that
    // could be tracked becomes a state that mysteriously changed.
    notes: (c.notes ?? []).map((n) => ({
      at: n.at,
      by: n.by,
      state: n.state,
      operator: n.operator ?? null,
      message: n.message ?? null,
    })),
    // Paths, never URLs. A signed URL written here would be dead within the
    // hour and the record would point at nothing.
    documents: (c.documents ?? []).map((d) => ({
      path: d.path,
      contentType: d.contentType,
      uploadedAt: d.uploadedAt,
    })),
  }));
}

/* -------------------------------------------------------------------------
   Showing the evidence
   ------------------------------------------------------------------------- */

/**
 * Short-lived, because these are photographs of somebody's Aadhaar.
 *
 * Fifteen minutes rather than the hour a listing photograph gets. A crop
 * photograph leaking is an embarrassment; an identity document leaking is
 * somebody's identity. Long enough to work a queue, short enough that a URL
 * pasted into a chat is useless by the time anyone opens it.
 */
const DOCUMENT_TTL_MS = 15 * 60 * 1000;

export interface SignedDocument {
  readonly url: string;
  readonly contentType: string;
  readonly uploadedAt: Date;
}

/** Signed view URLs for a check's evidence, in the order stored. */
export async function signDocuments(
  documents: readonly KycDocument[] | undefined,
): Promise<SignedDocument[]> {
  if (!documents || documents.length === 0) return [];

  // A deployment with no bucket configured still has a review queue worth
  // working — the numbers on each check are there. Throwing here would take the
  // whole page down over the photographs.
  let bucket: ReturnType<typeof adminStorage>;
  try {
    bucket = adminStorage();
  } catch {
    return [];
  }

  const expires = Date.now() + DOCUMENT_TTL_MS;

  const signed = await Promise.all(
    documents.map(async (document) => {
      // A content type we would not accept on the way in is not rendered on the
      // way out either — a stored `text/html` would otherwise open as a page
      // from our own signed origin.
      if (!isDocumentType(document.contentType)) return null;
      try {
        const [url] = await bucket
          .file(document.path)
          .getSignedUrl({ version: "v4", action: "read", expires });
        return {
          url,
          contentType: document.contentType,
          uploadedAt: document.uploadedAt,
        };
      } catch {
        // An upload that half-failed, or an object since deleted. Dropped
        // rather than shown as a tile that will not load.
        return null;
      }
    }),
  );

  return signed.filter((d): d is SignedDocument => d !== null);
}

export async function readChecks(
  role: Role,
  accountId: string | undefined,
): Promise<Check[]> {
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
 * Every account that has ever submitted a manual check.
 *
 * Three reads rather than a collection group query: the accounts live in three
 * collections with no shared parent, and a collection group needs an index per
 * field which is more moving parts than a queue this size justifies.
 *
 * Not filtered to what is waiting, because the same scan answers both questions
 * the review page asks — what needs deciding, and what was decided. Reading the
 * three collections twice to split them afterwards would double the cost of a
 * page that already reads everything.
 */
export const readKycAccounts = cache(async function readKycAccounts(): Promise<
  PendingReview[]
> {
  const db = adminDb();
  const sources: Array<{ collection: string; roles: Role[] }> = [
    { collection: "farmers", roles: ["farmer"] },
    { collection: "buyers", roles: ["buyer"] },
    // Its own collection since buyer and franchise were separated. Listed
    // rather than folded into `buyers`, or a franchise's documents would stop
    // reaching the review queue entirely.
    { collection: "franchises", roles: ["franchise"] },
    { collection: "agencies", roles: ["transport", "manpower"] },
  ];

  const queue: PendingReview[] = [];

  for (const source of sources) {
    const snapshot = await db.collection(source.collection).get();

    for (const doc of snapshot.docs) {
      const checks = shapeChecks(doc.data().kyc);
      // Manual only. An eKYC result was settled by an issuing authority and has
      // no photograph and no operator behind it — showing it in a review record
      // would credit operations with a decision nobody made.
      if (!checks.some((c) => c.method === "manual")) continue;
      const waiting = checks.filter((c) => c.state === "review");

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
});

/** Only what is waiting on operations, for callers that want the queue alone. */
export const readReviewQueue = cache(async function readReviewQueue(): Promise<
  PendingReview[]
> {
  const all = await readKycAccounts();
  return all.filter((entry) => entry.checks.some((c) => c.state === "review"));
});
