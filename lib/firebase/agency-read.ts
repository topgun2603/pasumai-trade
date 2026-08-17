import "server-only";

import type {
  Agency,
  AgencyService,
  ComplianceDocument,
  DocumentKind,
  VerificationStatus,
} from "@/lib/domain/admin";
import { agencies as sampleAgencies } from "@/lib/mock/admin";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * An agency, from Firestore, falling back to the samples.
 *
 * The console used to read the hard-coded sample array and nothing else, which
 * worked for exactly as long as nobody registered an agency. The moment
 * operations created a real one and issued it a login, `requireAgency` looked
 * for it among five fixtures, did not find it, and returned a 404 — an account
 * that signs in successfully and then insists it does not exist.
 *
 * The samples stay as a fallback so the console still demonstrates itself on a
 * machine with no credentials, which is what they were for.
 */

const SERVICES: AgencyService[] = ["transport", "manpower"];

const STATUSES: VerificationStatus[] = ["pending", "verified", "rejected", "suspended"];

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function toDocuments(value: unknown): ComplianceDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): ComplianceDocument[] => {
    if (!raw || typeof raw !== "object") return [];
    const d = raw as Record<string, unknown>;
    if (typeof d.kind !== "string") return [];
    return [
      {
        kind: d.kind as DocumentKind,
        reference: typeof d.reference === "string" ? d.reference : "",
        expiresAt: d.expiresAt ? toDate(d.expiresAt) : undefined,
        verifiedAt: d.verifiedAt ? toDate(d.verifiedAt) : undefined,
      },
    ];
  });
}

export function shapeAgency(id: string, data: Record<string, unknown>): Agency {
  const services = Array.isArray(data.services)
    ? (data.services.filter((s): s is AgencyService =>
        SERVICES.includes(s as AgencyService),
      ) as AgencyService[])
    : [];

  const districts = Array.isArray(data.districts)
    ? data.districts.filter((d): d is string => typeof d === "string")
    : [];

  const district = typeof data.district === "string" ? data.district : "";

  return {
    id,
    name: typeof data.name === "string" ? data.name : id,
    services,
    contactName: typeof data.contactName === "string" ? data.contactName : "",
    mobile: typeof data.mobile === "string" ? data.mobile : "",
    email: typeof data.email === "string" ? data.email : "",
    district,
    town: typeof data.town === "string" ? data.town : district,
    // An agency that named no districts still covers its own — otherwise a
    // newly registered firm can be sent nothing at all, which reads to them as
    // a platform with no work on it.
    districts: districts.length > 0 ? districts : district ? [district] : [],
    status: STATUSES.includes(data.status as VerificationStatus)
      ? (data.status as VerificationStatus)
      : "pending",
    registeredAt: toDate(data.registeredAt),
    documents: toDocuments(data.documents),
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
  };
}

/** One agency by id. Undefined when nothing anywhere knows it. */
export async function readAgency(id: string, now: Date): Promise<Agency | undefined> {
  if (!id) return undefined;

  if (hasAdminCredentials()) {
    try {
      const doc = await adminDb().collection("agencies").doc(id).get();
      if (doc.exists) return shapeAgency(doc.id, doc.data()!);
    } catch (error) {
      // Fall through to the samples rather than 404 an account that exists.
      console.error("agency unreadable", { id, error });
    }
  }

  return sampleAgencies(now).find((agency) => agency.id === id);
}

/**
 * Every agency, Firestore first.
 *
 * Samples that Firestore also holds are dropped, so a seeded project does not
 * show each of them twice.
 */
export async function readAgencies(now: Date): Promise<Agency[]> {
  const samples = sampleAgencies(now);
  if (!hasAdminCredentials()) return samples;

  try {
    const snapshot = await adminDb().collection("agencies").get();
    if (snapshot.empty) return samples;

    const stored = snapshot.docs.map((doc) => shapeAgency(doc.id, doc.data()));
    const known = new Set(stored.map((agency) => agency.id));

    return [...stored, ...samples.filter((agency) => !known.has(agency.id))].sort((a, b) =>
      a.name.localeCompare(b.name, "en-IN"),
    );
  } catch (error) {
    console.error("agencies unreadable", error);
    return samples;
  }
}
