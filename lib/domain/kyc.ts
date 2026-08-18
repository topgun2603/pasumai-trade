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
  // GST is optional, not absent. Plenty of real businesses on this platform
  // are under the registration threshold or are composition dealers, and a
  // buyer who cannot produce a GSTIN is a buyer, not a fraud. It is asked for,
  // it is verified when given, and it does not stand between anybody and the
  // market.
  buyer: ["identity", "pan", "bank"],
  franchise: ["identity", "pan", "bank"],
  transport: ["identity", "pan", "bank"],
  manpower: ["identity", "pan", "bank"],
};

export const OPTIONAL_CHECKS: Record<Role, readonly CheckKind[]> = {
  admin: [],
  farmer: ["pan"],
  buyer: ["gst", "fssai"],
  franchise: ["gst", "fssai"],
  transport: ["gst"],
  manpower: ["gst"],
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
  /**
   * Operations have asked a question and are waiting on an answer.
   *
   * Not a rejection. Somebody whose GST certificate is in a company name that
   * does not match their bank account has not failed anything — a person needs
   * to ask which is right. Refusing them outright would send them back to the
   * start of a queue for something a sentence could settle.
   */
  | "moreInfo"
  /**
   * The evidence itself was no good — a blurred photograph, a cropped page, the
   * wrong side of a card. Distinct from `moreInfo` because the fix is different:
   * take the picture again rather than answer anything.
   */
  | "reupload"
  /** eKYC contradicted it, or operations refused it. */
  | "failed";

/**
 * Whose move it is.
 *
 * The question every verification screen and every queue is really asking, and
 * the one that decides who gets notified. Operations chasing an applicant who
 * is already waiting on operations is how a queue stops meaning anything.
 */
export type Waiting = "nobody" | "applicant" | "operations";

export function waitingOn(state: CheckState): Waiting {
  switch (state) {
    case "review":
      return "operations";
    case "notStarted":
    case "pending":
    case "moreInfo":
    case "reupload":
    case "failed":
      return "applicant";
    case "verified":
      return "nobody";
  }
}

/* -------------------------------------------------------------------------
   The evidence itself
   ------------------------------------------------------------------------- */

/**
 * A photograph or scan of the document behind a check.
 *
 * The gap this closes: a manual check used to be a *number* and nothing else —
 * a masked Aadhaar, a PAN, an IFSC. An operator approving one was vouching for
 * a string somebody typed, with nothing to look at. The queue said "review" and
 * there was nothing to review.
 *
 * A **path**, never a URL. The bucket is private and its URLs are signed for an
 * hour; storing one would give a link that is dead by the time anybody opens
 * the record, and a permanently public URL for a photograph of somebody's
 * Aadhaar is not a thing to have.
 */
export interface KycDocument {
  /** Storage path. Composed by the server; never taken from a client. */
  readonly path: string;
  readonly contentType: string;
  readonly uploadedAt: Date;
}

/**
 * Per submission, not per check.
 *
 * Both sides of an Aadhaar card, a passbook page, and a spare for the one that
 * came out blurred. More than that on a single check is somebody uploading
 * their whole folder, which makes the queue slower to work rather than better
 * evidenced.
 */
export const MAX_DOCUMENTS = 4;

/**
 * The ceiling across every pass.
 *
 * Documents accumulate rather than replace — see `withDocuments` — so an
 * account sent back three times would otherwise grow without limit.
 */
export const MAX_DOCUMENTS_KEPT = 12;

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

/**
 * What can be uploaded as evidence.
 *
 * Phone photographs, and PDF because a GST certificate and an FSSAI licence
 * arrive as downloads rather than pictures — refusing those would send the
 * buyers who have the cleanest evidence off to find a screenshot tool.
 */
export function isDocumentType(type: string): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"].includes(
    type.toLowerCase(),
  );
}

/**
 * Adds evidence to a check without discarding what was there.
 *
 * Appended rather than replaced, and this is the point of the whole record: an
 * account on its third pass through the queue should show the blurred first
 * photograph next to the clear third one. Replacing would destroy the evidence
 * that operations were right to send it back — and destroy the one thing that
 * distinguishes somebody who fixed a genuine problem from somebody who keeps
 * sending the same unreadable page.
 *
 * Newest first, because an operator is deciding on the latest and should not
 * have to swipe past three rejected attempts to reach it.
 */
export function withDocuments(
  check: Check,
  documents: readonly KycDocument[],
): Check {
  if (documents.length === 0) return check;
  return {
    ...check,
    documents: [...documents, ...(check.documents ?? [])].slice(0, MAX_DOCUMENTS_KEPT),
  };
}

/**
 * One thing operations said, or the applicant did.
 *
 * Append-only, and the reason the queue can be tracked rather than merely
 * acted on: "rejected" with no history is a dead end that a person then
 * telephones about. A trail shows that the certificate was asked for twice,
 * what was asked, and what came back.
 */
export interface ReviewNote {
  readonly at: Date;
  /** Operations, or the person being verified. */
  readonly by: "operations" | "applicant";
  /** Operator identity, for the audit trail. Never shown to the applicant. */
  readonly operator?: string;
  readonly state: CheckState;
  /** What was asked or said. Written to be read by the applicant. */
  readonly message?: string;
}

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
  /** Everything said about this check, oldest first. */
  readonly notes?: readonly ReviewNote[];
  /**
   * Photographs or scans of the document, newest first.
   *
   * Absent on eKYC, which has no photograph — the authority answered directly
   * and there is nothing for a person to look at.
   */
  readonly documents?: readonly KycDocument[];
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
  /**
   * Operations have asked for something and are waiting on the applicant.
   *
   * Kept apart from `inProgress`, which is somebody who has simply not finished
   * yet. This one has been asked a question, and the difference decides both
   * what their screen says and whether chasing them is fair.
   */
  | "needsApplicant"
  /** At least one required check was refused. */
  | "rejected";

export const KYC_LABELS: Record<KycState, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  verified: "Verified",
  awaitingApproval: "Waiting for approval",
  needsApplicant: "Waiting on you",
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

  // Anything operations have asked about outranks the rest. Somebody who has
  // been asked a question needs to see that above "in progress", which reads as
  // though the platform is still working on it.
  if (
    required.some((kind) => {
      const state = found(kind)?.state;
      return state === "moreInfo" || state === "reupload";
    })
  ) {
    return "needsApplicant";
  }

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
    // `moreInfo` and `reupload` are outstanding: they are back with the
    // applicant and there is something for them to do.
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
export function recordManual(
  kind: CheckKind,
  reference: string,
  now: Date,
  documents: readonly KycDocument[] = [],
): Check {
  return {
    kind,
    method: "manual",
    state: "review",
    reference,
    checkedAt: now,
    documents: documents.length > 0 ? documents : undefined,
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
  return {
    ...check,
    state: "verified",
    approvedBy,
    checkedAt: now,
    notes: note(check, "operations", "verified", undefined, approvedBy, now),
  };
}

export function reject(check: Check, approvedBy: string, reason: string, now: Date): Check {
  if (check.state === "verified") {
    // Withdrawing a verification is a different act with different consequences
    // — it should suspend the account, not quietly flip a check.
    throw new KycError("Suspend the account instead of rejecting a verified check.");
  }
  return {
    ...check,
    state: "failed",
    approvedBy,
    reason,
    checkedAt: now,
    notes: note(check, "operations", "failed", reason, approvedBy, now),
  };
}

/** Append to the trail without losing what is already there. */
function note(
  check: Check,
  by: ReviewNote["by"],
  state: CheckState,
  message: string | undefined,
  operator: string | undefined,
  at: Date,
): ReviewNote[] {
  return [...(check.notes ?? []), { at, by, state, message, operator }];
}

/**
 * Operations asking a question rather than deciding.
 *
 * The middle ground the queue did not have. An applicant whose certificate is
 * in a slightly different company name has not failed anything, and rejecting
 * them for it sends them back to the start of a queue over something a sentence
 * settles. The question is required — "more information needed" with no
 * question is a delay the applicant cannot act on.
 */
export function askForMore(
  check: Check,
  operator: string,
  question: string,
  now: Date,
): Check {
  if (check.state === "verified") {
    throw new KycError("This check is already verified. Suspend the account instead.");
  }
  if (!question.trim()) {
    throw new KycError("Say what is needed. A request with no question cannot be answered.");
  }
  return {
    ...check,
    state: "moreInfo",
    approvedBy: operator,
    reason: question,
    checkedAt: now,
    notes: note(check, "operations", "moreInfo", question, operator, now),
  };
}

/**
 * Operations asking for the document again.
 *
 * Separate from `askForMore` because the fix is different — take the
 * photograph again rather than answer a question — and because the applicant's
 * screen should offer an upload rather than a text box.
 */
export function askForReupload(
  check: Check,
  operator: string,
  whatIsWrong: string,
  now: Date,
): Check {
  if (check.state === "verified") {
    throw new KycError("This check is already verified. Suspend the account instead.");
  }
  if (!whatIsWrong.trim()) {
    throw new KycError(
      "Say what is wrong with it. \"Upload it again\" produces the same photograph.",
    );
  }
  return {
    ...check,
    state: "reupload",
    approvedBy: operator,
    reason: whatIsWrong,
    checkedAt: now,
    notes: note(check, "operations", "reupload", whatIsWrong, operator, now),
  };
}

/**
 * The applicant answering, or sending the document again.
 *
 * Puts the check back in front of operations and records what was said, so the
 * queue shows a conversation rather than a state that mysteriously changed.
 */
export function respond(check: Check, message: string | undefined, now: Date): Check {
  if (check.state !== "moreInfo" && check.state !== "reupload") {
    throw new KycError("Nothing was asked about this check.");
  }
  return {
    ...check,
    state: "review",
    // The operator's question is answered; carrying it forward would show as
    // the reason on a check that is now waiting on us.
    reason: undefined,
    checkedAt: now,
    notes: note(check, "applicant", "review", message, undefined, now),
  };
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
 * The shape of a GSTIN, and deliberately not its check digit.
 *
 * Fifteen characters: state code, PAN, entity number, Z, checksum. That much is
 * documented and unambiguous, and it catches the errors people actually make —
 * a missing character, a transposed pair, a PAN pasted into the wrong box.
 *
 * The check digit is *not* verified, and that is a decision rather than an
 * omission. An implementation of it sat here and rejected real GSTINs that
 * businesses were typing in correctly; I could not establish from the material
 * I had whether the fault was in the algorithm or in the numbers I was testing
 * it against, and a validator nobody can prove correct is not a validator — it
 * is a door that sticks. Wrongly refusing a real GSTIN costs a customer;
 * wrongly accepting a mistyped one costs an operator ten seconds at review,
 * where the number is checked against the register anyway.
 *
 * When GST verification goes through an API — the KYC_API_BASE provider —
 * the register answers this properly and the question stops being ours.
 */
export function isWellFormedGstin(value: string): boolean {
  const gstin = value.replace(/\s/g, "").toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
}
