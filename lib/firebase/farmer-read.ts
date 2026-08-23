import "server-only";

import type { ComplianceDocument, FarmerAccount, VerificationStatus } from "@/lib/domain/admin";

import { adminDb } from "./admin";
import { signedPhoto } from "./photo-url";

/**
 * One farmer, read from Firestore.
 *
 * The farm console used to find its farmer in the mock catalogue, which worked
 * for the seeded demo accounts and 404ed for every real one — self-signup
 * writes to Firestore and nowhere else, so anybody who registered themselves
 * was refused their own console.
 *
 * Firestore is now the only source. The seeded farmers are written there too,
 * so this covers demo and real accounts with one path rather than a lookup that
 * silently means different things depending on where the account came from.
 */

const STATUSES: VerificationStatus[] = ["pending", "verified", "rejected", "suspended"];

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function shapeDocuments(value: unknown): ComplianceDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): ComplianceDocument[] => {
    if (!raw || typeof raw !== "object") return [];
    const d = raw as Record<string, unknown>;
    // A document with no kind cannot be labelled, checked for expiry or shown.
    // Dropped rather than rendered as an "undefined" row.
    if (typeof d.kind !== "string") return [];
    return [
      {
        kind: d.kind as ComplianceDocument["kind"],
        reference: typeof d.reference === "string" ? d.reference : "",
        expiresAt: toDate(d.expiresAt),
        verifiedAt: toDate(d.verifiedAt),
      },
    ];
  });
}

export async function readFarmer(accountId: string): Promise<FarmerAccount | null> {
  const snapshot = await adminDb().collection("farmers").doc(accountId).get();
  if (!snapshot.exists) return null;

  const d = snapshot.data()!;
  const status = typeof d.status === "string" && STATUSES.includes(d.status as VerificationStatus)
    ? (d.status as VerificationStatus)
    // An unreadable status is treated as pending rather than verified. The
    // wrong guess in the other direction would hand someone a verified badge
    // and the dispatch rights that go with it.
    : "pending";

  return {
    id: snapshot.id,
    name: typeof d.name === "string" ? d.name : "",
    mobile: typeof d.mobile === "string" ? d.mobile : "",
    village: typeof d.village === "string" ? d.village : "",
    district: typeof d.district === "string" ? d.district : "",
    bankAccountTail: typeof d.bankAccountTail === "string" ? d.bankAccountTail : "",
    status,
    registeredAt: toDate(d.registeredAt) ?? new Date(0),
    registeredBy: typeof d.registeredBy === "string" ? d.registeredBy : "",
    activeListings: typeof d.activeListings === "number" ? d.activeListings : 0,
    completedOrders: typeof d.completedOrders === "number" ? d.completedOrders : 0,
    // Signed, not the raw storage path — see lib/firebase/photo-url.ts.
    photoUrl: await signedPhoto(d.photoUrl),
    landPhotoUrl: typeof d.landPhotoUrl === "string" ? d.landPhotoUrl : undefined,
    documents: shapeDocuments(d.documents),
  };
}
