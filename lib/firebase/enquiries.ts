import "server-only";

import type { Enquiry, EnquiryNote, EnquiryStatus, Interest } from "@/lib/domain/enquiry";
import { ENQUIRY_STATUSES } from "@/lib/domain/enquiry";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Enquiries from the landing page.
 *
 * Their own collection rather than a subcollection of anything: an enquiry
 * belongs to nobody yet. That is the whole point of it — a person who has no
 * account asking for one — and hanging it off an account would mean inventing
 * the account first.
 */

const COLLECTION = "enquiries";

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

export function shapeEnquiry(id: string, data: Record<string, unknown>): Enquiry {
  const status = ENQUIRY_STATUSES.includes(data.status as EnquiryStatus)
    ? (data.status as EnquiryStatus)
    : // An unreadable status becomes `new` rather than being dropped. Losing an
      // enquiry means losing a person who asked to be called; showing one twice
      // costs an operator ten seconds.
      "new";

  return {
    id,
    interest: data.interest === "farmer" ? "farmer" : ("buyer" as Interest),
    name: typeof data.name === "string" ? data.name : "",
    organisation: typeof data.organisation === "string" ? data.organisation : undefined,
    mobile: typeof data.mobile === "string" ? data.mobile : "",
    district: typeof data.district === "string" ? data.district : "",
    message: typeof data.message === "string" ? data.message : undefined,
    status,
    createdAt: toDate(data.createdAt) ?? new Date(0),
    locale: typeof data.locale === "string" ? data.locale : undefined,
    notes: Array.isArray(data.notes)
      ? data.notes.flatMap((raw): EnquiryNote[] => {
          const n = raw as Record<string, unknown>;
          const at = toDate(n.at);
          if (!at) return [];
          return [
            {
              at,
              operator: typeof n.operator === "string" ? n.operator : undefined,
              status: ENQUIRY_STATUSES.includes(n.status as EnquiryStatus)
                ? (n.status as EnquiryStatus)
                : "contacted",
              message: typeof n.message === "string" ? n.message : undefined,
            },
          ];
        })
      : undefined,
  };
}

/** Firestore rejects `undefined`, so every absent field is written as null. */
function serialise(enquiry: Omit<Enquiry, "id">): Record<string, unknown> {
  return {
    interest: enquiry.interest,
    name: enquiry.name,
    organisation: enquiry.organisation ?? null,
    mobile: enquiry.mobile,
    district: enquiry.district,
    message: enquiry.message ?? null,
    status: enquiry.status,
    createdAt: enquiry.createdAt,
    locale: enquiry.locale ?? null,
    notes: (enquiry.notes ?? []).map((note) => ({
      at: note.at,
      operator: note.operator ?? null,
      status: note.status,
      message: note.message ?? null,
    })),
  };
}

export async function writeEnquiry(enquiry: Omit<Enquiry, "id">): Promise<string> {
  const ref = adminDb().collection(COLLECTION).doc();
  await ref.set(serialise(enquiry));
  return ref.id;
}

export async function readEnquiries(): Promise<Enquiry[]> {
  if (!hasAdminCredentials()) return [];
  const snapshot = await adminDb().collection(COLLECTION).get();
  return snapshot.docs.map((doc) => shapeEnquiry(doc.id, doc.data()));
}

export async function readEnquiry(id: string): Promise<Enquiry | null> {
  const snapshot = await adminDb().collection(COLLECTION).doc(id).get();
  return snapshot.exists ? shapeEnquiry(snapshot.id, snapshot.data()!) : null;
}

export async function updateEnquiry(enquiry: Enquiry): Promise<void> {
  const { id, ...rest } = enquiry;
  await adminDb().collection(COLLECTION).doc(id).set(serialise(rest), { merge: true });
}

/**
 * How many nobody has called yet.
 *
 * A `count()` aggregation, billed as one document read whatever the size of the
 * collection. This runs on every admin page load to feed the badge in the rail,
 * so it must not be a scan.
 */
export async function countWaiting(): Promise<number> {
  if (!hasAdminCredentials()) return 0;
  try {
    const snapshot = await adminDb()
      .collection(COLLECTION)
      .where("status", "==", "new")
      .count()
      .get();
    return snapshot.data().count;
  } catch {
    // A badge is not worth taking the console down for.
    return 0;
  }
}
