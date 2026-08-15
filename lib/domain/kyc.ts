import type { Role } from "@/lib/auth/claims";

import type { DocumentKind } from "./admin";

/**
 * Know Your Customer, two ways.
 *
 * **eKYC** is the main road: a check the platform can make against an issuing
 * authority in seconds, with a cryptographic or API answer at the end of it.
 * When every required check comes back verified, the account is verified — no
 * person looks at it, because there is nothing for a person to add. A human
 * re-reading a UIDAI signature that already validated is theatre.
 *
 * **Manual** is the fallback for everyone eKYC cannot serve: no smartphone, an
 * Aadhaar whose mobile number is long dead, a firm whose GSTIN predates the
 * API. They upload photographs and wait for operations. That wait is real and
 * the interface says so up front rather than implying it will be instant.
 *
 * The rule that keeps the two honest: **a manual submission can never mark
 * itself verified.** Only `approve()`, called by operations, moves it. Every
 * function here that touches a manual check refuses to do it.
 */

/* -------------------------------------------------------------------------
   What is being checked
   ------------------------------------------------------------------------- */

export type CheckKind =
  /** Who the person is. Aadhaar offline eKYC, or DigiLocker. */
  | "identity"
  /** PAN, for tax. */
  | "pan"
  /** GSTIN, for a registered business. */
  | "gst"
  /** A bank account that can actually be paid into. */
  | "bank"
  /** FSSAI, for anyone handling food at scale. */
  | "fssai";

export const CHECK_LABELS: Record<CheckKind, string> = {
  identity: "Identity",
  pan: "PAN",
  gst: "GST registration",
  bank: "Bank account",
  fssai: "FSSAI licence",
};

/** The document each check is evidenced by when it is done manually. */
export const DOCUMENT_FOR_CHECK: Record<CheckKind, DocumentKind> = {
  identity: "aadhaar",
  pan: "pan",
  gst: "gst",
  bank: "bankProof",
  fssai: "fssai",
};

/**
 * What each role has to clear, and what is merely useful.
 *
 * A farmer is asked for the least the platform can operate on: who they are and
 * where the money goes. Every extra field is a farmer who stops halfway, and
 * PAN is not needed to buy vegetables from someone.
 *
 * A buying business is asked for more because it is invoiced, and a GSTIN is
 * how an invoice becomes claimable.
 */
export const REQUIRED_CHECKS: Record<Role, readonly CheckKind[]> = {
  admin: [],
  farmer: ["identity", "bank"],
  buyer: ["identity", "pan", "gst", "bank"],
  franchise: ["identity", "pan", "gst", "bank"],
  transport: ["identity", "pan", "gst", "bank"],
  manpower: ["identity", "pan", "bank"],
};

export const OPTIONAL_CHECKS: Record<Role, readonly CheckKind[]> = {
  admin: [],
  farmer: ["pan"],
  buyer: ["fssai"],
  franchise: ["fssai"],
  transport: [],
  manpower: [],
};

/* -------------------------------------------------------------------------
   How it was checked, and how that went
   ------------------------------------------------------------------------- */

export type CheckMethod =
  /** Verified against the issuing authority. Trustworthy without a person. */
  | "ekyc"
  /** A photograph of a document. Trustworthy only once a person has looked. */
  | "manual";

export type CheckState =
  | "notStarted"
  /** eKYC begun — a consent screen open, an OTP outstanding. */
  | "pending"
  /** Cleared. Either eKYC succeeded, or operations approved a manual one. */
  | "verified"
  /** Manual evidence submitted, waiting on operations. */
  | "review"
  /** eKYC contradicted it, or operations refused it. */
  | "failed";

export interface Check {
  readonly kind: CheckKind;
  readonly method: CheckMethod;
  readonly state: CheckState;
  /**
   * What was checked, safe to store and safe to show.
   *
   * Never a full Aadhaar number. See `maskAadhaar` — the Aadhaar Act permits
   * the last four digits and nothing more, and "we will be careful with it" is
   * not a control.
   */
  readonly reference?: string;
  /** Name as the authority holds it, for comparison against what they typed. */
  readonly verifiedName?: string;
  readonly checkedAt?: Date;
  /** Who approved a manual check. Absent on eKYC, which nobody approves. */
  readonly approvedBy?: string;
  /** Why it failed, in words the person can act on. */
  readonly reason?: string;
}

/* -------------------------------------------------------------------------
   The account's overall standing
   ------------------------------------------------------------------------- */

export type KycState =
  | "notStarted"
  /** Some checks done, some not. */
  | "inProgress"
  /** Everything required is verified. The account is live. */
  | "verified"
  /** Everything required is submitted, and at least one needs a person. */
  | "awaitingApproval"
  /** At least one required check was refused. */
  | "rejected";

export const KYC_LABELS: Record<KycState, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  verified: "Verified",
  awaitingApproval: "Waiting for approval",
  rejected: "Rejected",
};

/**
 * Where an account stands, from its checks.
 *
 * Derived rather than stored. A stored status is a status that drifts from the
 * checks under it the first time one is re-run, and then two parts of the
 * console disagree about whether somebody is verified.
 *
 * Order matters. A rejection outranks everything — an account with one refused
 * check is not "in progress" however much else is done. Then awaiting
 * approval, because that is the state the person most needs named: they have
 * finished, and the wait is not their fault.
 */
export function kycState(checks: readonly Check[], role: Role): KycState {
  const required = REQUIRED_CHECKS[role];
  if (required.length === 0) return "verified";

  const found = (kind: CheckKind) => checks.find((c) => c.kind === kind);

  if (required.some((kind) => found(kind)?.state === "failed")) return "rejected";
  if (required.every((kind) => found(kind)?.state === "verified")) return "verified";

  const submitted = required.every((kind) => {
    const state = found(kind)?.state;
    return state === "verified" || state === "review";
  });
  if (submitted) return "awaitingApproval";

  return required.some((kind) => found(kind)) ? "inProgress" : "notStarted";
}

/** Checks still to do, in the order they should be asked for. */
export function outstandingChecks(checks: readonly Check[], role: Role): CheckKind[] {
  return REQUIRED_CHECKS[role].filter((kind) => {
    const state = checks.find((c) => c.kind === kind)?.state;
    return state !== "verified" && state !== "review";
  });
}

/** How far along, for a progress bar that is not a lie. */
export function kycProgress(
  checks: readonly Check[],
  role: Role,
): { done: number; total: number } {
  const required = REQUIRED_CHECKS[role];
  const done = required.filter((kind) => {
    const state = checks.find((c) => c.kind === kind)?.state;
    return state === "verified" || state === "review";
  }).length;
  return { done, total: required.length };
}

/**
 * Does this account still need a person to look at it?
 *
 * The question the onboarding screen turns on: an account whose checks all came
 * back by eKYC is finished the moment the last one lands, and telling that
 * person to "wait for approval" would be inventing a queue they are not in.
 */
export function needsHumanReview(checks: readonly Check[], role: Role): boolean {
  return REQUIRED_CHECKS[role].some(
    (kind) => checks.find((c) => c.kind === kind)?.state === "review",
  );
}

/* -------------------------------------------------------------------------
   Recording a result
   ------------------------------------------------------------------------- */

export class KycError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KycError";
  }
}

/**
 * Records an eKYC result.
 *
 * Only ever called with an answer that came from an issuing authority, which is
 * why this is the one path allowed to write `verified` without a person. The
 * caller proves that by construction: `lib/kyc/verify.ts` is the only module
 * that calls it, and it only calls it with a provider's response.
 */
export function recordEkyc(
  kind: CheckKind,
  result: {
    verified: boolean;
    reference?: string;
    verifiedName?: string;
    reason?: string;
  },
  now: Date,
): Check {
  return {
    kind,
    method: "ekyc",
    state: result.verified ? "verified" : "failed",
    reference: result.reference,
    verifiedName: result.verifiedName,
    reason: result.reason,
    checkedAt: now,
  };
}

/**
 * Records a manual submission.
 *
 * Always `review`. There is no argument to this function that could make it
 * return `verified`, deliberately: the state that means "a person vouched for
 * this" must be unreachable from the path where no person has.
 */
export function recordManual(kind: CheckKind, reference: string, now: Date): Check {
  return {
    kind,
    method: "manual",
    state: "review",
    reference,
    checkedAt: now,
  };
}

/**
 * Operations approving a manual check.
 *
 * Refuses to approve an eKYC check, which sounds pedantic and is not: an
 * operator "approving" a failed eKYC would be overriding UIDAI on a hunch, and
 * the audit trail would show a verified identity with no evidence behind it.
 * A failed eKYC is re-run or submitted manually; it is not waved through.
 */
export function approve(check: Check, approvedBy: string, now: Date): Check {
  if (check.method !== "manual") {
    throw new KycError(
      "Only a manual check can be approved. An eKYC result stands on its own evidence.",
    );
  }
  if (check.state !== "review") {
    throw new KycError(`This check is ${check.state}, not waiting for review.`);
  }
  return { ...check, state: "verified", approvedBy, checkedAt: now };
}

export function reject(check: Check, approvedBy: string, reason: string, now: Date): Check {
  if (check.state === "verified") {
    // Withdrawing a verification is a different act with different consequences
    // — it should suspend the account, not quietly flip a check.
    throw new KycError("Suspend the account instead of rejecting a verified check.");
  }
  return { ...check, state: "failed", approvedBy, reason, checkedAt: now };
}

/* -------------------------------------------------------------------------
   Aadhaar
   ------------------------------------------------------------------------- */

/**
 * The last four digits, and nothing else, ever.
 *
 * The Aadhaar Act and the UIDAI regulations under it do not let a private
 * platform store full Aadhaar numbers. This is the only representation that
 * goes to the database, and it is produced here so there is exactly one place
 * to check that it is true.
 *
 * The full number is used to compute this and is then out of scope. It is never
 * a field on any interface in this codebase.
 */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, "");
  if (digits.length !== 12) throw new KycError("An Aadhaar number is twelve digits.");
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/**
 * The Verhoeff checksum Aadhaar numbers carry.
 *
 * Catches invented and mistyped numbers before anything is sent anywhere —
 * roughly all single-digit errors and adjacent transpositions. It says a number
 * is *well-formed*, never that it belongs to anyone; only UIDAI can say that,
 * and conflating the two is how "Aadhaar verified" comes to mean nothing.
 */
const D_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isWellFormedAadhaar(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^[2-9][0-9]{11}$/.test(digits)) return false; // never starts 0 or 1

  let c = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = D_TABLE[c][P_TABLE[i % 8][reversed[i]]];
  }
  return c === 0;
}

/**
 * The GSTIN check digit.
 *
 * Base-36 over the first fourteen characters, weighted alternately 1 and 2,
 * with the quotient folded back in. Catches a mistyped GSTIN at the form rather
 * than at the tax return.
 */
const GST_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function isWellFormedGstin(value: string): boolean {
  const gstin = value.replace(/\s/g, "").toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GST_ALPHABET.indexOf(gstin[i]);
    if (value < 0) return false;
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }

  return GST_ALPHABET[(36 - (sum % 36)) % 36] === gstin[14];
}
