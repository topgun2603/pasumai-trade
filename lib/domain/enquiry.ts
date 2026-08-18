/**
 * Somebody asking to be let onto the platform.
 *
 * The landing page has carried this form since the beginning and it went
 * nowhere: the handler waited half a second and showed "we will call you". Not
 * a bug in the sense of something that broke — nothing was ever built behind
 * it. Every person who filled it in was told they would be contacted, and no
 * record of them exists.
 *
 * So an enquiry is now a record with a life of its own: it arrives, an operator
 * picks it up, and it ends either as an account or as a reason it did not
 * become one. The point of the status is that "nobody has called this person"
 * is a state you can see from across the room, rather than something you infer
 * from an inbox.
 */

export type Interest = "buyer" | "farmer";

export type EnquiryStatus =
  /** Nobody has looked at it yet. What the badge counts. */
  | "new"
  /** An operator has taken it and is working on it. */
  | "contacted"
  /** It became an account. */
  | "converted"
  /** It will not become one, and the reason says why. */
  | "closed";

export const ENQUIRY_STATUSES: readonly EnquiryStatus[] = [
  "new",
  "contacted",
  "converted",
  "closed",
];

export const STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Became an account",
  closed: "Closed",
};

export interface EnquiryNote {
  readonly at: Date;
  readonly operator?: string;
  readonly status: EnquiryStatus;
  readonly message?: string;
}

export interface Enquiry {
  readonly id: string;
  readonly interest: Interest;
  readonly name: string;
  readonly organisation?: string;
  readonly mobile: string;
  readonly district: string;
  readonly message?: string;
  readonly status: EnquiryStatus;
  readonly createdAt: Date;
  /** Which language they were reading in when they asked. */
  readonly locale?: string;
  readonly notes?: readonly EnquiryNote[];
}

/** What the badge counts: nobody has called these people. */
export function isWaiting(status: EnquiryStatus): boolean {
  return status === "new";
}

/**
 * Open first, oldest first within that.
 *
 * The same rule the KYC queue uses, and for the same reason: a list sorted
 * newest-first is how the person who has waited longest goes on waiting.
 */
export function inWorkingOrder(enquiries: readonly Enquiry[]): Enquiry[] {
  return [...enquiries].sort((a, b) => {
    const openness = Number(isWaiting(b.status)) - Number(isWaiting(a.status));
    if (openness !== 0) return openness;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export class EnquiryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnquiryError";
  }
}

/**
 * Moving an enquiry along, with the trail kept.
 *
 * Closing demands a reason. An operator looking at a closed enquiry six weeks
 * later needs to know whether this was a wrong number or a buyer who went
 * elsewhere, and "closed" on its own answers neither — which is how the same
 * person gets telephoned twice.
 */
export function advance(
  enquiry: Enquiry,
  status: EnquiryStatus,
  operator: string,
  message: string | undefined,
  now: Date,
): Enquiry {
  if (enquiry.status === status) {
    throw new EnquiryError(`This enquiry is already ${STATUS_LABELS[status].toLowerCase()}.`);
  }
  if (status === "closed" && !message?.trim()) {
    throw new EnquiryError("Say why it was closed, or nobody will know not to call again.");
  }
  if (status === "new") {
    // Nothing may be moved back to unread. The badge would then be counting
    // work an operator has already done.
    throw new EnquiryError("An enquiry cannot be marked new again.");
  }

  return {
    ...enquiry,
    status,
    notes: [
      ...(enquiry.notes ?? []),
      { at: now, operator, status, message: message?.trim() || undefined },
    ],
  };
}

/* -------------------------------------------------------------------------
   What may be submitted
   ------------------------------------------------------------------------- */

/** Long enough for a real message, short enough not to be a payload. */
export const MAX_MESSAGE = 600;
const MAX_FIELD = 120;

export interface EnquiryDraft {
  interest: string;
  name: string;
  organisation: string;
  mobile: string;
  district: string;
  message: string;
  locale: string;
}

/**
 * Checked on the server as well as in the form.
 *
 * The form's validation is a courtesy to somebody typing; this is the one that
 * counts, because the form is a page anybody can skip. It is deliberately
 * lenient about everything except the three fields an operator needs to make
 * the call — a name, a number, and where they are.
 */
export function validate(draft: EnquiryDraft): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) errors.name = "Give a name.";
  else if (draft.name.trim().length > MAX_FIELD) errors.name = "That name is too long.";

  // Ten digits, with or without +91 and spaces. Anything else is a number
  // nobody can ring, and an enquiry nobody can ring is not an enquiry.
  const digits = draft.mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (!/^[6-9][0-9]{9}$/.test(digits)) {
    errors.mobile = "Enter a ten-digit Indian mobile number.";
  }

  if (!draft.district.trim()) errors.district = "Say which district you are in.";
  else if (draft.district.trim().length > MAX_FIELD) errors.district = "That is too long.";

  if (draft.organisation.trim().length > MAX_FIELD) {
    errors.organisation = "That is too long.";
  }
  if (draft.message.length > MAX_MESSAGE) {
    errors.message = `Keep it under ${MAX_MESSAGE} characters.`;
  }

  return errors;
}

/** The ten digits, however they were typed. Stored in one shape so it dials. */
export function normaliseMobile(mobile: string): string {
  return mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}
