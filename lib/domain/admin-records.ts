import type { VerificationStatus } from "@/lib/domain/admin";

/**
 * The records operations can approve, refuse or suspend.
 *
 * One table for seven admin screens, because the alternative is seven copies of
 * a collection name and a status rule — and the row action that changes a
 * status is the last place a typo should be able to write to the wrong
 * collection.
 *
 * This exists because those actions were not wired at all. The menu showed
 * Approve and Reject and called `toast.success("… approved")`: it told an
 * operator the account was live and changed nothing, which is worse than a
 * button that does not work, because nobody goes looking for the account
 * afterwards.
 */

export const RECORD_KINDS = [
  "buyers",
  "franchises",
  "farmers",
  "agencies",
  "drivers",
  "vehicles",
  "workers",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value);
}

export interface RecordDefinition {
  readonly collection: string;
  /** Singular, for a confirmation that names what is about to change. */
  readonly one: string;
  /**
   * The console directory this record has a dossier on, if any.
   *
   * Accounts do; a lorry does not. "View details" is offered only where there
   * is something to view — an item that opens nothing is the defect this file
   * exists to remove, in a smaller form.
   */
  readonly dossier?: "farmers" | "buyers" | "franchises" | "transport" | "manpower";
}

export const RECORDS: Record<RecordKind, RecordDefinition> = {
  buyers: { collection: "buyers", one: "Buyer", dossier: "buyers" },
  franchises: { collection: "franchises", one: "Franchise", dossier: "franchises" },
  farmers: { collection: "farmers", one: "Farmer", dossier: "farmers" },
  // Transport and manpower share `agencies`; the directory is picked by the
  // role on the account, which this table does not carry, so it points at the
  // transport one and that page reads whichever the record actually is.
  agencies: { collection: "agencies", one: "Agency", dossier: "transport" },
  drivers: { collection: "drivers", one: "Driver" },
  vehicles: { collection: "vehicles", one: "Vehicle" },
  workers: { collection: "workers", one: "Worker" },
};

/**
 * Which status changes are allowed, and from where.
 *
 * Written as a table rather than as conditions at the call site, because the
 * one that matters is not obvious: a **rejected** record can be approved later.
 * Operations refuse a blurry photograph, the person sends a better one, and the
 * account has to be able to come back — a one-way rejection would mean deleting
 * and re-registering, losing the audit trail the refusal exists to keep.
 */
const ALLOWED: Record<VerificationStatus, readonly VerificationStatus[]> = {
  pending: ["verified", "rejected"],
  verified: ["suspended"],
  rejected: ["verified", "pending"],
  suspended: ["verified"],
};

export function canMove(from: VerificationStatus, to: VerificationStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

/** What each move is called where a person reads it. */
export const MOVE_LABELS: Record<string, string> = {
  verified: "Approve",
  rejected: "Reject",
  suspended: "Suspend",
  pending: "Reopen",
};
