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

import type {
  Agency,
  AgencyService,
  BuyerAccount,
  BuyerKind,
  ComplianceDocument,
  DocumentKind,
  DriverAccount,
  EngagementBasis,
  FarmerAccount,
  ManpowerSkill,
  VehicleType,
  Vehicle,
  VerificationStatus,
  Worker,
} from "@/lib/domain/admin";
import { MANPOWER_SKILLS } from "@/lib/domain/admin";
import { money } from "@/lib/domain/money";

import { adminDb, hasAdminCredentials } from "./admin";
import { withSignedPhotos } from "./photo-url";

/**
 * Everyone and everything the consoles list.
 *
 * This replaces `lib/mock/admin` — six functions returning hand-written
 * fixtures that twenty-one screens were reading as though they were records.
 * The collections had been seeded to Firestore all along; nothing read them.
 *
 * The consequence was not cosmetic. An agency signing in saw five vehicles that
 * were not theirs and none that were; the compliance banner warned about a
 * lorry nobody owns; and a real driver whose licence had lapsed appeared
 * nowhere. A console showing confident, wrong data is worse than one showing
 * none, because nobody thinks to check it.
 *
 * Every shaper here is defensive in the same direction: an unreadable status
 * becomes `pending`, never `verified`. Clearing something nobody checked is the
 * one failure mode that matters.
 */

const DOCUMENT_KINDS: DocumentKind[] = [
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

const STATUSES: VerificationStatus[] = [
  "pending",
  "verified",
  "rejected",
  "suspended",
];

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Never `verified` by accident. See the note at the top of this file. */
function status(value: unknown): VerificationStatus {
  return STATUSES.includes(value as VerificationStatus)
    ? (value as VerificationStatus)
    : "pending";
}

function documents(raw: unknown): ComplianceDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): ComplianceDocument[] => {
    if (!entry || typeof entry !== "object") return [];
    const d = entry as Record<string, unknown>;
    if (!DOCUMENT_KINDS.includes(d.kind as DocumentKind)) return [];
    return [
      {
        kind: d.kind as DocumentKind,
        reference: str(d.reference),
        // Absent rather than null: a PAN does not lapse, and the domain reads a
        // missing date as "does not expire" rather than as "expired".
        expiresAt: toDate(d.expiresAt),
        verifiedAt: toDate(d.verifiedAt),
        files: Array.isArray(d.files)
          ? d.files.flatMap((f) => {
              // Shaped field by field like everything else here: a document
              // written before uploads were real carries no files at all.
              if (!f || typeof f !== "object") return [];
              const file = f as Record<string, unknown>;
              return typeof file.path === "string" && file.path
                ? [{ path: file.path, contentType: str(file.contentType) }]
                : [];
            })
          : [],
      },
    ];
  });
}

/** A collection read that returns nothing rather than taking a console down. */
async function readAll<T>(
  collection: string,
  shape: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  if (!hasAdminCredentials()) return [];
  try {
    const snapshot = await adminDb().collection(collection).get();
    /*
      Portraits are signed here, once, for every roster read there is.

      `photoUrl` holds a storage path, and every screen showing one passed it
      to `next/image`, which resolved it against our own origin and got a 404.
      The seeded rows store `/mock/portrait.svg` and did render, so the screens
      looked right and only the real photographs were missing.
    */
    return withSignedPhotos(snapshot.docs.map((doc) => shape(doc.id, doc.data())));
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------
   Transport and crew
   ------------------------------------------------------------------------- */

const VEHICLE_TYPES: VehicleType[] = ["miniTruck", "tempo", "truck", "reefer"];

export const readVehicles = cache(function readVehicles(): Promise<Vehicle[]> {
  return readAll("vehicles", (id, data) => ({
    id,
    registration: str(data.registration, id),
    type: VEHICLE_TYPES.includes(data.type as VehicleType)
      ? (data.type as VehicleType)
      : "miniTruck",
    capacityKg: num(data.capacityKg),
    agencyId: str(data.agencyId),
    owner: str(data.owner),
    district: str(data.district),
    status: status(data.status),
    registeredAt: toDate(data.registeredAt) ?? new Date(0),
    assignedDriver:
      typeof data.assignedDriver === "string" ? data.assignedDriver : undefined,
    refrigerated: data.refrigerated === true,
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    platePhotoUrl:
      typeof data.platePhotoUrl === "string" ? data.platePhotoUrl : undefined,
    documents: documents(data.documents),
  }));
});

export const readDrivers = cache(function readDrivers(): Promise<
  DriverAccount[]
> {
  return readAll("drivers", (id, data) => ({
    id,
    agencyId: str(data.agencyId),
    name: str(data.name, id),
    mobile: str(data.mobile),
    district: str(data.district),
    status: status(data.status),
    registeredAt: toDate(data.registeredAt) ?? new Date(0),
    tripsCompleted: num(data.tripsCompleted),
    assignedVehicle:
      typeof data.assignedVehicle === "string"
        ? data.assignedVehicle
        : undefined,
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    documents: documents(data.documents),
  }));
});

// Reused from the domain rather than restated, so a skill added there is
// not silently dropped by this reader.
const BASES: EngagementBasis[] = ["daily", "perTrip", "monthly"];

export const readWorkers = cache(function readWorkers(): Promise<Worker[]> {
  return readAll("workers", (id, data) => ({
    id,
    agencyId: str(data.agencyId),
    name: str(data.name, id),
    mobile: str(data.mobile),
    district: str(data.district),
    place: str(data.place),
    skills: Array.isArray(data.skills)
      ? data.skills.filter((s): s is ManpowerSkill =>
          (MANPOWER_SKILLS as readonly string[]).includes(s as string),
        )
      : [],
    basis: BASES.includes(data.basis as EngagementBasis)
      ? (data.basis as EngagementBasis)
      : "perTrip",
    rate: num(data.rate),
    status: status(data.status),
    registeredAt: toDate(data.registeredAt) ?? new Date(0),
    jobsCompleted: num(data.jobsCompleted),
    // Absent means on the roster. A field nobody has written should not take
    // somebody off it.
    available: data.available !== false,
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    documents: documents(data.documents),
  }));
});

const SERVICES: AgencyService[] = ["manpower", "transport"];

export const readAgencyRecords = cache(function readAgencyRecords(): Promise<
  Agency[]
> {
  return readAll("agencies", (id, data) => ({
    id,
    name: str(data.name, id),
    services: Array.isArray(data.services)
      ? data.services.filter((s): s is AgencyService =>
          SERVICES.includes(s as AgencyService),
        )
      : // A firm with no services listed is one nothing can be dispatched
        // from, which is a worse default than assuming the pair it registered
        // under. Both, and the console shows what it actually does.
        SERVICES,
    contactName: str(data.contactName),
    mobile: str(data.mobile),
    email: str(data.email),
    district: str(data.district),
    town: str(data.town),
    districts: Array.isArray(data.districts)
      ? data.districts.filter((d): d is string => typeof d === "string")
      : // Covers its own district by default, or a newly registered firm is
        // sent nothing at all and reads that as a platform with no work on it.
        [str(data.district)].filter(Boolean),
    status: status(data.status),
    registeredAt: toDate(data.registeredAt) ?? new Date(0),
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    documents: documents(data.documents),
  }));
});

/* -------------------------------------------------------------------------
   Trading accounts
   ------------------------------------------------------------------------- */

const BUYER_KINDS: BuyerKind[] = ["franchise", "independent"];

/**
 * Buyers and franchises share a record shape and no longer share a collection.
 *
 * One shaper, two callers. They were the same thing until they were not, and
 * the fields they carry are still identical — what differs is what each may
 * do, which is a matter for the consoles and the guards rather than for the
 * document.
 */
function shapeBuying(id: string, data: Record<string, unknown>): BuyerAccount {
  return {
    id,
    name: str(data.name, id),
    kind: BUYER_KINDS.includes(data.kind as BuyerKind)
      ? (data.kind as BuyerKind)
      : "independent",
    contactName: str(data.contactName),
    mobile: str(data.mobile),
    town: str(data.town, str(data.place)),
    district: str(data.district),
    ordersPlaced: num(data.ordersPlaced),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    status: status(data.status),
    registeredAt:
      toDate(data.registeredAt) ?? toDate(data.createdAt) ?? new Date(0),
    lifetimeValue: money(num(data.lifetimeValue)),
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    documents: documents(data.documents),
  };
}

export const readBuyerAccounts = cache(function readBuyerAccounts(): Promise<
  BuyerAccount[]
> {
  return readAll("buyers", shapeBuying);
});

export const readFranchiseAccounts = cache(
  function readFranchiseAccounts(): Promise<BuyerAccount[]> {
    return readAll("franchises", shapeBuying);
  },
);

export const readFarmerAccounts = cache(function readFarmerAccounts(): Promise<
  FarmerAccount[]
> {
  return readAll("farmers", (id, data) => ({
    id,
    name: str(data.name, id),
    mobile: str(data.mobile),
    village: str(data.village, str(data.place)),
    district: str(data.district),
    bankAccountTail: str(data.bankAccountTail),
    status: status(data.status),
    registeredAt:
      toDate(data.registeredAt) ?? toDate(data.createdAt) ?? new Date(0),
    registeredBy: str(data.registeredBy),
    activeListings: num(data.activeListings),
    completedOrders: num(data.completedOrders),
    photoUrl: typeof data.photoUrl === "string" ? data.photoUrl : undefined,
    landPhotoUrl:
      typeof data.landPhotoUrl === "string" ? data.landPhotoUrl : undefined,
    documents: documents(data.documents),
  }));
});

/**
 * One buying account, for the console's own chrome.
 *
 * The rail names whoever is signed in, and a buyer's name lives on their
 * account document rather than in their claims — claims hold what changes
 * rarely and a business changes its trading name.
 *
 * Returns the id as a last resort rather than an empty header. A rail with a
 * blank line under the wordmark reads as a page that failed to load.
 */
export const readBuyingAccount = cache(async function readBuyingAccount(
  role: string,
  accountId: string | undefined,
): Promise<BuyerAccount | null> {
  if (!accountId || !hasAdminCredentials()) return null;

  const collection = role === "franchise" ? "franchises" : "buyers";

  try {
    const snapshot = await adminDb().collection(collection).doc(accountId).get();
    if (!snapshot.exists) return null;

    /*
      Shaped by the same function the admin roster uses, so a buyer reading
      their own record and an operator reading it are reading one shape. Two
      shapers for one document is two places for a field to be dropped.
    */
    const [account] = await withSignedPhotos([shapeBuying(snapshot.id, snapshot.data()!)]);
    return account;
  } catch {
    return null;
  }
});
