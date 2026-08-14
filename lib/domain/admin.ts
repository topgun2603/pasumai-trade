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
  /** Owning account — a franchise, or the driver themselves. */
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
