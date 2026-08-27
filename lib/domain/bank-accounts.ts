import { checkAccountNumber } from "./bank";
import { compareNames, matchClearsAutomatically, type NameMatch } from "./name-match";
import { checkIfsc, type FieldErrors } from "./registration";

/**
 * More than one bank account, and exactly one of them getting the money.
 *
 * A farmer changes bank, a firm keeps a current account for receipts and
 * another for payouts, an agency is paid into whichever account its accountant
 * says this quarter. The platform held one set of fields on the account record
 * — `bankAccountTail` and nothing else — which meant changing bank was a phone
 * call to operations and there was nowhere to record that the old account had
 * ever been checked.
 *
 * Two ideas are kept apart here on purpose, because collapsing them is how
 * money goes to the wrong place:
 *
 *   **verified** — a penny drop reached this account and the name came back
 *   agreeing with ours. A fact about the world.
 *
 *   **primary** — the one a payout should use. A preference.
 *
 * The rule joining them is the only one that matters: **an account cannot be
 * made primary until it is verified.** An unverified primary is a payout
 * instruction the platform has not checked, and `lib/domain/bank.ts` already
 * explains at length why a wrong digit does not bounce — it pays somebody else.
 */

export type BankVerificationState =
  /** Added, nothing attempted yet. */
  | "unverified"
  /** A penny drop is in flight. The bank has not answered. */
  | "pending"
  /** Reached the account, and the registered name agreed. */
  | "verified"
  /**
   * Reached the account, but the name did not agree well enough to clear on its
   * own. Not a rejection — a question for operations.
   */
  | "mismatch"
  /** The account is invalid, or the attempt could not be completed. */
  | "failed";

/**
 * Named for verification, not for "bank state" — `lib/domain/bank.ts` already
 * exports `BANK_STATE_LABELS` for the format check on a single set of fields,
 * and two identically named maps meaning different things is a mis-import
 * waiting to happen.
 */
export const BANK_VERIFICATION_LABELS: Record<BankVerificationState, string> = {
  unverified: "Not verified",
  pending: "Checking…",
  verified: "Verified",
  mismatch: "Name needs checking",
  failed: "Could not verify",
};

export interface BankVerification {
  /** Which provider answered. `razorpayx` today; the field outlives it. */
  readonly provider: string;
  /** The provider's own id for the attempt, for tracing a dispute. */
  readonly validationId?: string;
  /** The name the bank holds. Kept so an operator can read it themselves. */
  readonly registeredName?: string;
  readonly accountStatus?: "active" | "invalid";
  readonly nameMatch?: NameMatch;
  readonly reason?: string;
  /** Every attempt costs real money. See `MAX_VERIFY_ATTEMPTS`. */
  readonly attempts: number;
  readonly checkedAt?: Date;
}

export interface BankAccount {
  readonly id: string;
  readonly accountName: string;
  readonly bankName: string;
  /**
   * The full number. Needed to pay into and to run a penny drop against.
   *
   * Never sent to a browser: `lib/firebase/bank-read.ts` masks it to a tail on
   * the way out, and the full value is read only inside a route handler that is
   * about to hand it to the provider.
   */
  readonly accountNumber: string;
  readonly ifsc: string;
  readonly primary: boolean;
  readonly state: BankVerificationState;
  readonly verification?: BankVerification;
  readonly addedAt: Date;
}

/** What the form collects. The id and the dates are ours to set. */
export interface BankAccountInput {
  readonly accountName: string;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly ifsc: string;
}

/**
 * Enough for a change of bank and a spare, not enough to be a list.
 *
 * The cap exists because each account is a penny-drop budget of its own, and an
 * unbounded list on a document read on every console render is a cost nobody
 * sees until it is large.
 */
export const MAX_BANK_ACCOUNTS = 5;

/**
 * How many times one account may be checked.
 *
 * A penny drop moves real money and is billed per attempt, so this is a spend
 * limit as much as a sanity limit. Somebody whose account fails three times has
 * a problem a fourth attempt will not solve — the fix is an operator, and
 * `mismatch` and `failed` both leave the manual road open.
 */
export const MAX_VERIFY_ATTEMPTS = 3;

/* -------------------------------------------------------------------------
   Validation
   ------------------------------------------------------------------------- */

/** Normalised the way it will be stored and sent: no spaces, upper case IFSC. */
export function normaliseInput(input: BankAccountInput): BankAccountInput {
  return {
    accountName: input.accountName.trim().replace(/\s+/g, " "),
    bankName: input.bankName.trim().replace(/\s+/g, " "),
    accountNumber: input.accountNumber.replace(/\s/g, ""),
    ifsc: input.ifsc.trim().replace(/\s/g, "").toUpperCase(),
  };
}

/**
 * Checked before a penny drop is ever attempted.
 *
 * A malformed IFSC is wrong no matter what any bank says, and catching it here
 * saves an attempt off a budget of three and a round trip that costs money.
 */
export function validateBankAccount(
  input: BankAccountInput,
): FieldErrors<BankAccountInput> {
  const clean = normaliseInput(input);
  return {
    accountName:
      clean.accountName === "" ? "Account holder name is required" : undefined,
    bankName: clean.bankName === "" ? "Bank name is required" : undefined,
    accountNumber: checkAccountNumber(clean.accountNumber),
    ifsc: checkIfsc(clean.ifsc),
  };
}

/** The same account under a different label is still the same account. */
export function findDuplicate(
  list: readonly BankAccount[],
  input: BankAccountInput,
): BankAccount | undefined {
  const clean = normaliseInput(input);
  return list.find(
    (account) =>
      account.accountNumber === clean.accountNumber &&
      account.ifsc === clean.ifsc,
  );
}

/* -------------------------------------------------------------------------
   Reading the list
   ------------------------------------------------------------------------- */

export function primaryAccount(
  list: readonly BankAccount[],
): BankAccount | undefined {
  return list.find((account) => account.primary);
}

/**
 * Whether the platform can actually pay this account holder.
 *
 * Deliberately not "has a bank account on file". A primary that is not verified
 * cannot exist by construction, so this is one condition; it is written out
 * anyway so callers read the intent rather than inferring it from `primary`.
 */
export function payoutReady(list: readonly BankAccount[]): boolean {
  const primary = primaryAccount(list);
  return primary !== undefined && primary.state === "verified";
}

export function canAttemptVerification(account: BankAccount): boolean {
  if (account.state === "pending" || account.state === "verified") return false;
  return (account.verification?.attempts ?? 0) < MAX_VERIFY_ATTEMPTS;
}

/* -------------------------------------------------------------------------
   What a browser is allowed to see
   ------------------------------------------------------------------------- */

/**
 * The list as it leaves the server.
 *
 * The account number is reduced to its last four digits and never leaves in
 * full. `BankPanel` has made this argument since it was written: a payout
 * screen open on a shared handset in a village should not put a whole account
 * number on it, and four digits are enough to recognise your own.
 *
 * The IFSC stays whole. It identifies a branch, not an account, and somebody
 * checking they picked the right branch needs to be able to read it.
 */
export interface PublicBankAccount {
  readonly id: string;
  readonly accountName: string;
  readonly bankName: string;
  /** Last four digits, already formatted. Never the whole number. */
  readonly tail: string;
  readonly ifsc: string;
  readonly primary: boolean;
  readonly state: BankVerificationState;
  /** The name the bank holds, shown so somebody can see what did not match. */
  readonly registeredName?: string;
  readonly nameMatch?: NameMatch;
  readonly reason?: string;
  readonly attemptsLeft: number;
  readonly canVerify: boolean;
  readonly checkedAt?: string;
}

export function toPublicBankAccount(account: BankAccount): PublicBankAccount {
  return {
    id: account.id,
    accountName: account.accountName,
    bankName: account.bankName,
    tail: account.accountNumber.slice(-4),
    ifsc: account.ifsc,
    primary: account.primary,
    state: account.state,
    registeredName: account.verification?.registeredName,
    nameMatch: account.verification?.nameMatch,
    reason: account.verification?.reason,
    attemptsLeft: Math.max(
      0,
      MAX_VERIFY_ATTEMPTS - (account.verification?.attempts ?? 0),
    ),
    canVerify: canAttemptVerification(account),
    checkedAt: account.verification?.checkedAt?.toISOString(),
  };
}

/* -------------------------------------------------------------------------
   Changing the list
   ------------------------------------------------------------------------- */

export class BankAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankAccountError";
  }
}

/**
 * Adds an account. Never primary on arrival, however empty the list is.
 *
 * The tempting shortcut is to make the first one primary for convenience. It
 * would mean an unchecked account is where the money goes for everybody who
 * only ever adds one — which is most people, and exactly the case the rule
 * about primary exists for. It becomes primary when it verifies, in
 * `applyVerification`, and not a moment earlier.
 */
export function addBankAccount(
  list: readonly BankAccount[],
  input: BankAccountInput,
  id: string,
  now: Date,
): BankAccount[] {
  if (list.length >= MAX_BANK_ACCOUNTS) {
    throw new BankAccountError(
      `Up to ${MAX_BANK_ACCOUNTS} bank accounts. Remove one you no longer use.`,
    );
  }
  if (findDuplicate(list, input)) {
    throw new BankAccountError("That account is already on the list.");
  }

  const clean = normaliseInput(input);
  return [
    ...list,
    {
      id,
      ...clean,
      primary: false,
      state: "unverified",
      addedAt: now,
    },
  ];
}

/** Marks an attempt as started, so the interface can show it and a retry cannot double-spend. */
export function markVerificationPending(
  list: readonly BankAccount[],
  id: string,
  validationId: string,
  now: Date,
): BankAccount[] {
  return list.map((account) => {
    if (account.id !== id) return account;
    /*
      The previous attempt's result is dropped rather than carried forward.

      A retry that kept the old `registeredName` and `accountStatus` would show
      the failed check's answer beside a spinner, and — worse — would leave a
      stale `active` on the record if the second attempt never came back.
      Only the attempt count survives, because that is the budget.
    */
    return {
      ...account,
      state: "pending",
      verification: {
        provider: account.verification?.provider ?? "razorpayx",
        validationId,
        // Counted on the way out, not on the way back. An attempt that never
        // returns still cost money and still used a try.
        attempts: (account.verification?.attempts ?? 0) + 1,
        checkedAt: now,
      },
    };
  });
}

/**
 * Records the provider's own id against an attempt already in flight.
 *
 * Separate from `markVerificationPending` because the attempt is reserved
 * *before* the provider is called — a double-clicked button must not buy two
 * penny drops — and the id only exists after it answers. Deliberately does not
 * touch `attempts`: this is the same attempt, now with a reference on it.
 */
export function recordValidationId(
  list: readonly BankAccount[],
  id: string,
  validationId: string,
): BankAccount[] {
  return list.map((account) => {
    if (account.id !== id || !account.verification) return account;
    return {
      ...account,
      verification: { ...account.verification, validationId },
    };
  });
}

export interface VerificationOutcome {
  readonly provider: string;
  readonly validationId?: string;
  readonly accountStatus?: "active" | "invalid";
  readonly registeredName?: string;
  readonly reason?: string;
}

/**
 * Records what the provider said, and promotes the account if it earned it.
 *
 * The name comparison happens here rather than at the call site so that every
 * path into a verified state runs the same rule — the webhook, the polled
 * fetch, and any future provider all land on this function.
 *
 * Promotion is the convenience that is actually safe: an account that has just
 * been proved is made primary only when there is no primary already. It never
 * displaces a working payout destination, because somebody adding a second
 * account has not asked to be paid into it.
 */
export function applyVerification(
  list: readonly BankAccount[],
  id: string,
  outcome: VerificationOutcome,
  now: Date,
): BankAccount[] {
  const updated = list.map((account): BankAccount => {
    if (account.id !== id) return account;

    const nameMatch: NameMatch | undefined = outcome.registeredName
      ? compareNames(account.accountName, outcome.registeredName)
      : undefined;

    /*
      A completed check is not a passed check.

      Razorpay returns `completed` with a null status and a null name for an
      account that does not exist, so absence is a verdict here rather than a
      missing field. Only an `active` account with a name that clears on its own
      becomes verified; an active account whose name is merely consistent waits
      for a person.
    */
    const state: BankVerificationState =
      outcome.accountStatus !== "active"
        ? "failed"
        : nameMatch && matchClearsAutomatically(nameMatch)
          ? "verified"
          : "mismatch";

    return {
      ...account,
      state,
      verification: {
        provider: outcome.provider,
        validationId: outcome.validationId ?? account.verification?.validationId,
        registeredName: outcome.registeredName,
        accountStatus: outcome.accountStatus,
        nameMatch,
        reason: outcome.reason,
        attempts: account.verification?.attempts ?? 1,
        checkedAt: now,
      },
    };
  });

  const justVerified = updated.find(
    (account) => account.id === id && account.state === "verified",
  );
  if (!justVerified) return updated;
  if (updated.some((account) => account.primary)) return updated;

  return updated.map((account) =>
    account.id === id ? { ...account, primary: true } : account,
  );
}

/**
 * Chooses where the money goes.
 *
 * Refuses anything not verified. This is the single rule the whole module is
 * built around, and it is enforced here rather than in the route handler so no
 * second caller can be written that forgets it.
 */
export function makePrimary(
  list: readonly BankAccount[],
  id: string,
): BankAccount[] {
  const target = list.find((account) => account.id === id);
  if (!target) throw new BankAccountError("No such bank account.");
  if (target.state !== "verified") {
    throw new BankAccountError(
      "Verify this account before making it the one you are paid into.",
    );
  }

  return list.map((account) => ({ ...account, primary: account.id === id }));
}

/**
 * Removes an account, and re-elects a primary if that was the one.
 *
 * Leaving the list with no primary would silently stop payouts, and the person
 * removing a stale account has not asked for that. Another verified account
 * takes over where one exists; where none does, there is genuinely nowhere to
 * pay and the interface says so.
 */
export function removeBankAccount(
  list: readonly BankAccount[],
  id: string,
): BankAccount[] {
  const target = list.find((account) => account.id === id);
  if (!target) throw new BankAccountError("No such bank account.");

  const remaining = list.filter((account) => account.id !== id);
  if (!target.primary) return remaining;

  const heir = remaining.find((account) => account.state === "verified");
  if (!heir) return remaining.map((account) => ({ ...account, primary: false }));

  return remaining.map((account) => ({
    ...account,
    primary: account.id === heir.id,
  }));
}
