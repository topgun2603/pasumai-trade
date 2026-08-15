/**
 * Platform administration.
 *
 * Everything the operations team governs: buyer accounts, farmers, drivers,
 * vehicles and the listings flowing through them.
 *
 * Two concepts run through every entity here, and they are what make an admin
 * console necessary rather than a convenience:
 *
 *  1. **Verification.** Nothing transacts until operations has checked it.
 *  2. **Document expiry.** A licence, insurance certificate or fitness
 *     certificate lapses silently. A driver with expired insurance moving
 *     produce is a liability event, so expiry is surfaced as loudly as
 *     verification.
 */
import type { Money } from "./money";

/* -------------------------------------------------------------------------
   Verification
   ------------------------------------------------------------------------- */

export type VerificationStatus =
  /** Submitted, waiting on operations. Cannot transact. */
  | "pending"
  /** Checked and live. */
  | "verified"
  /** Checked and refused. Kept, not deleted — the record is the audit trail. */
  | "rejected"
  /** Was live, stopped by operations. Reversible. */
  | "suspended";

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function needsReview(status: VerificationStatus): boolean {
  return status === "pending";
}

export function canTransact(status: VerificationStatus): boolean {
  return status === "verified";
}

/**
 * Operations have said no.
 *
 * Distinct from `!canTransact`, and the distinction now matters. A pending
 * account is simply one nobody has looked at yet — it browses, subscribes and
 * trades. A rejected or suspended one has been refused by a person, and no
 * subscription buys past that.
 */
export function blocked(status: VerificationStatus): boolean {
  return status === "rejected" || status === "suspended";
}

/* -------------------------------------------------------------------------
   Documents
   ------------------------------------------------------------------------- */

export type DocumentKind =
  | "aadhaar"
  | "pan"
  | "gst"
  | "bankProof"
  | "drivingLicence"
  | "rc"
  | "insurance"
  | "fitness"
  | "permit"
  | "fssai";

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  gst: "GST",
  bankProof: "Bank proof",
  drivingLicence: "Driving licence",
  rc: "RC",
  insurance: "Insurance",
  fitness: "Fitness certificate",
  permit: "Permit",
  fssai: "FSSAI licence",
};

export interface ComplianceDocument {
  readonly kind: DocumentKind;
  readonly reference: string;
  /** Absent for documents that do not lapse, such as PAN. */
  readonly expiresAt?: Date;
  readonly verifiedAt?: Date;
}

export type ExpiryState = "valid" | "expiringSoon" | "expired" | "noExpiry";

/**
 * Renewals in India routinely take weeks, so thirty days is the useful alarm.
 * Now a platform-policy figure; this stays as the value used when a caller has
 * no policy to hand, which is what the platform did before Controls existed.
 */
const EXPIRING_SOON_DAYS = 30;

export function expiryState(
  document: ComplianceDocument,
  now: number,
  warnWithinDays: number = EXPIRING_SOON_DAYS,
): ExpiryState {
  if (!document.expiresAt) return "noExpiry";
  const daysLeft = (document.expiresAt.getTime() - now) / 86_400_000;
  if (daysLeft < 0) return "expired";
  if (daysLeft <= warnWithinDays) return "expiringSoon";
  return "valid";
}

export function daysUntilExpiry(
  document: ComplianceDocument,
  now: number,
): number | null {
  if (!document.expiresAt) return null;
  return Math.floor((document.expiresAt.getTime() - now) / 86_400_000);
}

/**
 * The worst state across a set of documents.
 *
 * A vehicle is only as compliant as its weakest certificate — valid insurance
 * does not help when the fitness certificate lapsed last week.
 */
export function worstExpiry(
  documents: readonly ComplianceDocument[],
  now: number,
): ExpiryState {
  let worst: ExpiryState = "noExpiry";
  for (const doc of documents) {
    const state = expiryState(doc, now);
    if (state === "expired") return "expired";
    if (state === "expiringSoon") worst = "expiringSoon";
    else if (state === "valid" && worst === "noExpiry") worst = "valid";
  }
  return worst;
}

export function expiringDocuments(
  documents: readonly ComplianceDocument[],
  now: number,
): ComplianceDocument[] {
  return documents.filter((d) => {
    const state = expiryState(d, now);
    return state === "expired" || state === "expiringSoon";
  });
}

/* -------------------------------------------------------------------------
   Accounts
   ------------------------------------------------------------------------- */

/**
 * A buying account.
 *
 * One role, two flavours. A contracted franchise and an independent bulk
 * buyer have identical capabilities — `kind` is a commercial label that
 * affects credit terms and nothing else. Small buyers are out of scope.
 */
export type BuyerKind = "franchise" | "independent";

export const BUYER_KIND_LABELS: Record<BuyerKind, string> = {
  franchise: "Franchise",
  independent: "Independent",
};

export interface BuyerAccount {
  readonly id: string;
  readonly name: string;
  readonly kind: BuyerKind;
  readonly contactName: string;
  readonly mobile: string;
  readonly town: string;
  readonly district: string;
  /**
   * Where the buyer takes delivery.
   *
   * Freight is farm → buyer, so nothing can be quoted without it. Held as
   * coordinates rather than as a distance for the same reason a village is:
   * distance depends on both ends, and only the pair has an answer.
   */
  readonly lat?: number | null;
  readonly lng?: number | null;
  /** Districts this account is allowed to source from. */
  readonly districts: readonly string[];
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly ordersPlaced: number;
  /**
   * Total transacted to date.
   *
   * There is no credit on this platform. Every order is paid at the point it
   * is placed, so an account carries no balance and no limit — which also
   * removes the working-capital gap that would otherwise sit between paying
   * the farmer and collecting from the buyer.
   */
  readonly lifetimeValue: Money;
  /** Premises photograph. Absent until one is uploaded. */
  readonly photoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

/**
 * A farmer account.
 *
 * Assembled by a franchise during onboarding — the farmer never fills this in,
 * and bank details are collected and verified offline because they are the
 * highest drop-off field in rural sign-up. `registeredBy` is therefore always
 * populated, and it is who operations calls when something looks wrong.
 */
export interface FarmerAccount {
  readonly id: string;
  readonly name: string;
  readonly mobile: string;
  readonly village: string;
  readonly district: string;
  readonly bankAccountTail: string;
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly registeredBy: string;
  readonly activeListings: number;
  readonly completedOrders: number;
  /** Portrait, taken at onboarding and shown to the driver at pickup. */
  readonly photoUrl?: string;
  /** Photograph of the land, a sanity check against the declared acreage. */
  readonly landPhotoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

export interface DriverAccount {
  readonly id: string;
  /** The transport agency that registered and is answerable for this driver. */
  readonly agencyId: string;
  readonly name: string;
  readonly mobile: string;
  readonly district: string;
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly tripsCompleted: number;
  /** Registration of the vehicle currently assigned, if any. */
  readonly assignedVehicle?: string;
  /** Portrait, shown to the farmer at pickup so the right person is met. */
  readonly photoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

/**
 * A supplier company: a labour contractor, a transport contractor, or both.
 *
 * The platform does not employ crews or own trucks. It contracts agencies, and
 * an agency knows its own people and its own vehicles far better than
 * operations ever could — which is why the agency registers them, under its own
 * login, and operations sees everything without having to type any of it.
 *
 * That split is also where liability sits. The agency vouches for its workers
 * and its fleet; the platform verifies the agency and audits what it registers.
 */
export const AGENCY_SERVICES = ["manpower", "transport"] as const;

export type AgencyService = (typeof AGENCY_SERVICES)[number];

export const AGENCY_SERVICE_LABELS: Record<AgencyService, string> = {
  manpower: "Manpower",
  transport: "Transport",
};

export interface Agency {
  readonly id: string;
  readonly name: string;
  /**
   * What this agency is contracted for. Both is common — a contractor that
   * supplies loaders usually supplies the vehicle they load onto.
   */
  readonly services: readonly AgencyService[];
  readonly contactName: string;
  readonly mobile: string;
  readonly email: string;
  readonly district: string;
  readonly town: string;
  /** Districts it will actually send crew or vehicles to. */
  readonly districts: readonly string[];
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly photoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

export function offers(agency: Agency, service: AgencyService): boolean {
  return agency.services.includes(service);
}

/**
 * Whether anything this agency registers may be dispatched.
 *
 * Checked above the individual record: a verified driver working for a
 * suspended agency must not be sent out, and the driver is not the problem.
 */
export function agencyDispatchable(agency: Agency, now: number): boolean {
  return canTransact(agency.status) && worstExpiry(agency.documents, now) !== "expired";
}

/**
 * What a hand is engaged to do.
 *
 * A crew is picked by skill, not by headcount: a load of graded tomatoes needs
 * someone who can grade, and sending four loaders to a job that needed a
 * weighman is how a vehicle sits idle at the farm gate.
 */
export const MANPOWER_SKILLS = [
  "loading",
  "grading",
  "packing",
  "weighing",
  "coldChain",
] as const;

export type ManpowerSkill = (typeof MANPOWER_SKILLS)[number];

export const MANPOWER_SKILL_LABELS: Record<ManpowerSkill, string> = {
  loading: "Loading",
  grading: "Grading",
  packing: "Packing",
  weighing: "Weighing",
  coldChain: "Cold chain",
};

export type EngagementBasis = "daily" | "perTrip" | "monthly";

export const ENGAGEMENT_LABELS: Record<EngagementBasis, string> = {
  daily: "Per day",
  perTrip: "Per trip",
  monthly: "Monthly",
};

/**
 * A labourer on an agency's books.
 *
 * Entered by the agency, not by operations — the agency knows who turned up
 * this season. Operations sees every worker across every agency and verifies
 * them, but does not do the data entry.
 *
 * The rate is on the record rather than negotiated per job. A crew that agrees
 * its price at the roadside, with produce waiting and a vehicle running, is a
 * crew paid whatever the pressure of the moment decides.
 */
export interface Worker {
  readonly id: string;
  /** The agency that registered and is answerable for this person. */
  readonly agencyId: string;
  readonly name: string;
  readonly mobile: string;
  readonly district: string;
  /** Where they are based. Dispatch prefers the nearest available crew. */
  readonly place: string;
  readonly skills: readonly ManpowerSkill[];
  readonly basis: EngagementBasis;
  /** Agreed rate in paise, on the stated basis. Integer, like all money here. */
  readonly rate: number;
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly jobsCompleted: number;
  /**
   * Off the roster without being removed — sick, on leave, or working
   * elsewhere this season. Distinct from verification: a verified hand who is
   * unavailable must not be assigned, and an unavailable hand is not a
   * compliance problem.
   */
  readonly available: boolean;
  readonly photoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

/** Whether this hand can be put on a job today. */
export function workerDispatchable(worker: Worker, now: number): boolean {
  if (!canTransact(worker.status)) return false;
  if (!worker.available) return false;
  return worstExpiry(worker.documents, now) !== "expired";
}

export type VehicleType = "miniTruck" | "tempo" | "truck" | "reefer";

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  miniTruck: "Mini truck",
  tempo: "Tempo",
  truck: "Truck",
  reefer: "Reefer",
};

export interface Vehicle {
  readonly id: string;
  /** `TN 20 BA 4471`. What everyone actually calls the vehicle. */
  readonly registration: string;
  readonly type: VehicleType;
  readonly capacityKg: number;
  /** The transport agency that registered it and is answerable for it. */
  readonly agencyId: string;
  /** Registered owner on the RC, which is not always the agency. */
  readonly owner: string;
  readonly district: string;
  readonly status: VerificationStatus;
  readonly registeredAt: Date;
  readonly assignedDriver?: string;
  /** Reefers are the only vehicles that can carry short-shelf-life stock. */
  readonly refrigerated: boolean;
  readonly photoUrl?: string;
  /** Number plate close-up, checked against `registration`. */
  readonly platePhotoUrl?: string;
  readonly documents: readonly ComplianceDocument[];
}

/* -------------------------------------------------------------------------
   Queue
   ------------------------------------------------------------------------- */

export interface AdminAttention {
  readonly pendingBuyers: number;
  readonly pendingFarmers: number;
  readonly pendingDrivers: number;
  readonly pendingVehicles: number;
  readonly expiredDocuments: number;
  readonly expiringDocuments: number;
  readonly stoppedAccounts: number;
}

export function totalPending(attention: AdminAttention): number {
  return (
    attention.pendingBuyers +
    attention.pendingFarmers +
    attention.pendingDrivers +
    attention.pendingVehicles
  );
}
