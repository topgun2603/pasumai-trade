import "server-only";

import type {
  ComplianceDocument,
  DocumentKind,
  VerificationStatus,
} from "@/lib/domain/admin";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Everything on the platform that carries a certificate that can lapse.
 *
 * The overview page was reading all of this from `lib/mock/admin` — five
 * fixtures with invented expiry dates — while the real `vehicles`, `drivers`
 * and `workers` collections sat in Firestore unread. So the banner warning that
 * a vehicle was off the road was warning about a vehicle nobody owns, and a
 * genuinely lapsed insurance certificate would not have appeared anywhere.
 *
 * One shape for all four kinds, because the question is the same for each: is
 * this thing legal to send out today. What differs is only where it is reviewed,
 * which is why `href` is carried rather than derived by the page.
 */

const KINDS: DocumentKind[] = [
  "aadhaar",
  "pan",
  "gst",
  "bankProof",
  "drivingLicence",
  "rc",
  "insurance",
  "fitness",
  "permit",
  "fssai",
];

export type SubjectKind = "Vehicle" | "Driver" | "Crew" | "Buyer";

export interface ComplianceSubject {
  readonly id: string;
  /** Registration for a vehicle, a person's name otherwise. */
  readonly name: string;
  readonly kind: SubjectKind;
  /** Where an operator goes to deal with it. */
  readonly href: string;
  readonly status: VerificationStatus;
  readonly documents: ComplianceDocument[];
  readonly registeredAt?: Date;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function shapeDocuments(raw: unknown): ComplianceDocument[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): ComplianceDocument[] => {
    if (!entry || typeof entry !== "object") return [];
    const d = entry as Record<string, unknown>;
    if (!KINDS.includes(d.kind as DocumentKind)) return [];

    return [
      {
        kind: d.kind as DocumentKind,
        reference: typeof d.reference === "string" ? d.reference : "",
        // Absent rather than null. A PAN does not lapse, and the domain reads
        // a missing date as "does not expire" rather than as "expired".
        expiresAt: toDate(d.expiresAt),
        verifiedAt: toDate(d.verifiedAt),
      },
    ];
  });
}

export interface Compliance {
  readonly subjects: ComplianceSubject[];
  /** False when there is no database to ask, so the page can say so. */
  readonly live: boolean;
}

export async function readCompliance(): Promise<Compliance> {
  if (!hasAdminCredentials()) return { subjects: [], live: false };

  try {
    const db = adminDb();
    const [vehicleDocs, driverDocs, workerDocs, buyerDocs] = await Promise.all([
      db.collection("vehicles").get(),
      db.collection("drivers").get(),
      db.collection("workers").get(),
      db.collection("buyers").get(),
    ]);

    /*
      Narrowed here rather than by every caller. An unreadable status becomes
      `pending`, which is the safe direction: it puts the record in front of an
      operator rather than clearing something nobody checked.
    */
    const STATUSES: VerificationStatus[] = ["pending", "verified", "rejected", "suspended"];
    const status = (data: Record<string, unknown>): VerificationStatus =>
      STATUSES.includes(data.status as VerificationStatus)
        ? (data.status as VerificationStatus)
        : "pending";

    const subjects: ComplianceSubject[] = [
      ...vehicleDocs.docs.map((doc): ComplianceSubject => {
        const data = doc.data();
        return {
          id: doc.id,
          // A lorry is known by its plate. Nobody in a depot calls it V-408.
          name: typeof data.registration === "string" ? data.registration : doc.id,
          kind: "Vehicle",
          href: "/admin/transport/vehicles",
          status: status(data),
          documents: shapeDocuments(data.documents),
          registeredAt: toDate(data.registeredAt),
        };
      }),
      ...driverDocs.docs.map((doc): ComplianceSubject => {
        const data = doc.data();
        return {
          id: doc.id,
          name: typeof data.name === "string" ? data.name : doc.id,
          kind: "Driver",
          href: "/admin/transport/drivers",
          status: status(data),
          documents: shapeDocuments(data.documents),
          registeredAt: toDate(data.registeredAt),
        };
      }),
      ...workerDocs.docs.map((doc): ComplianceSubject => {
        const data = doc.data();
        return {
          id: doc.id,
          name: typeof data.name === "string" ? data.name : doc.id,
          kind: "Crew",
          href: "/admin/transport/manpower",
          status: status(data),
          documents: shapeDocuments(data.documents),
          registeredAt: toDate(data.registeredAt),
        };
      }),
      ...buyerDocs.docs.map((doc): ComplianceSubject => {
        const data = doc.data();
        return {
          id: doc.id,
          name: typeof data.name === "string" ? data.name : doc.id,
          kind: "Buyer",
          href: "/admin/buyers",
          status: status(data),
          documents: shapeDocuments(data.documents),
          registeredAt: toDate(data.registeredAt),
        };
      }),
    ];

    return { subjects, live: true };
  } catch {
    return { subjects: [], live: false };
  }
}

/* -------------------------------------------------------------------------
   Loads that have not found a vehicle
   ------------------------------------------------------------------------- */

export interface WaitingPickup {
  readonly id: string;
  readonly farmerName: string;
  readonly produceName: string;
  readonly quantity: number;
  readonly unit: string;
  readonly district: string;
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

/**
 * Produce that is cut and has nobody coming for it.
 *
 * The most time-critical thing on this platform, and the overview had no idea
 * it existed. A window that has run out is included: the request stops being
 * offered to drivers the moment it lapses, and nothing sweeps the document, so
 * an expired one is a farmer whose produce is sitting in the sun and whose
 * screen has gone quiet.
 */
export async function readWaitingPickups(): Promise<WaitingPickup[]> {
  if (!hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection("pickups")
      .where("status", "in", ["searching", "expired"])
      .get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          farmerName: typeof data.farmerName === "string" ? data.farmerName : "",
          produceName: typeof data.produceName === "string" ? data.produceName : "",
          quantity: typeof data.quantity === "number" ? data.quantity : 0,
          unit: typeof data.unit === "string" ? data.unit : "kg",
          district: typeof data.pickupDistrict === "string" ? data.pickupDistrict : "",
          requestedAt: toDate(data.requestedAt) ?? new Date(0),
          expiresAt: toDate(data.expiresAt) ?? new Date(0),
        };
      })
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  } catch {
    return [];
  }
}
