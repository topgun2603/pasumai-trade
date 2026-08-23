import { checkIfsc } from "./registration";

/**
 * When a bank section counts as done.
 *
 * Bug 18 asked for a bank detail page and one rule with it: the section is
 * marked verified only once the bank name and account details have been given
 * **and validated**. That second half is the part worth having a domain
 * function for.
 *
 * The failure it prevents is specific. A farmer's payout goes to whatever
 * digits are on file, and a wrong digit does not bounce — it pays somebody
 * else, and the money is gone. A green "verified" tick beside a half-filled
 * bank section is therefore not a cosmetic defect: it is the platform saying
 * it has checked something it has not.
 *
 * Note what this is not. It is not proof the account exists or belongs to
 * them — that needs a penny-drop through a payout provider, which the platform
 * does not have yet. So the strongest thing that can honestly be said here is
 * "complete and well-formed", and `bankState` says exactly that rather than
 * borrowing the word "verified" from the KYC flow, which means something
 * stronger.
 */

export interface BankDetails {
  readonly accountName?: string;
  readonly bankName?: string;
  readonly accountNumber?: string;
  readonly ifsc?: string;
}

export type BankState =
  /** Nothing on file. */
  | "empty"
  /** Some of it, not all. */
  | "partial"
  /** Everything present, but something does not pass its format check. */
  | "invalid"
  /** Complete and well-formed. Not the same as proven to exist. */
  | "complete";

export const BANK_STATE_LABELS: Record<BankState, string> = {
  empty: "Not provided",
  partial: "Incomplete",
  invalid: "Needs correcting",
  complete: "On file",
};

function filled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** An Indian account number: 9 to 18 digits, and nothing else. */
export function checkAccountNumber(value: string): string | undefined {
  const digits = value.trim();
  if (digits === "") return "Account number is required";
  if (!/^\d{9,18}$/.test(digits)) {
    return "An account number is 9 to 18 digits";
  }
  return undefined;
}

export function bankState(details: BankDetails): BankState {
  const parts = [
    details.accountName,
    details.bankName,
    details.accountNumber,
    details.ifsc,
  ];
  const given = parts.filter(filled).length;

  if (given === 0) return "empty";
  if (given < parts.length) return "partial";

  // Everything is present. Now does it hold up?
  const wrong =
    checkAccountNumber(details.accountNumber!) !== undefined ||
    checkIfsc(details.ifsc!) !== undefined;

  return wrong ? "invalid" : "complete";
}

/**
 * The single question every screen actually asks.
 *
 * Kept separate from `bankState` so no caller has to remember which of the
 * four states counts as done — the one that gets that wrong is the one that
 * shows a tick against an invalid IFSC.
 */
export function bankIsUsable(details: BankDetails): boolean {
  return bankState(details) === "complete";
}
