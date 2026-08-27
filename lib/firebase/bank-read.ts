import "server-only";

import type { Role } from "@/lib/auth/claims";
import type {
  BankAccount,
  BankVerificationState,
  BankVerification,
} from "@/lib/domain/bank-accounts";
import type { NameMatch } from "@/lib/domain/name-match";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";

import { adminDb } from "./admin";

/**
 * Bank accounts live on the account document, under `bankAccounts`.
 *
 * Same reasoning as `kyc` next to it in `kyc-read.ts`: every guard that needs
 * them has already loaded the account, and a subcollection would be a second
 * read on a path that renders on every console page.
 *
 * The array holds **full account numbers**, which is the one thing about this
 * module worth remembering. Firestore rules let an account read its own
 * document, so a farmer can see their own number and nobody else's — but
 * nothing here should hand a full number to a browser, and
 * `toPublicBankAccount` in the domain module is how it gets masked on the way
 * out. Read the raw form only where a number is about to be sent to a payout
 * or validation provider.
 */

const STATES: BankVerificationState[] = [
  "unverified",
  "pending",
  "verified",
  "mismatch",
  "failed",
];

const MATCHES: NameMatch[] = ["exact", "close", "mismatch"];

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function shapeVerification(raw: unknown): BankVerification | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const status = d.accountStatus;
  const match = d.nameMatch;

  return {
    provider: str(d.provider) ?? "razorpayx",
    validationId: str(d.validationId),
    registeredName: str(d.registeredName),
    accountStatus:
      status === "active" || status === "invalid" ? status : undefined,
    nameMatch: MATCHES.includes(match as NameMatch)
      ? (match as NameMatch)
      : undefined,
    reason: str(d.reason),
    /*
      An unreadable attempt count reads as the cap, not as zero.

      Zero would hand somebody a fresh budget of real money every time a field
      failed to parse, which is the wrong way for a spend limit to fail.
    */
    attempts: typeof d.attempts === "number" ? d.attempts : Number.MAX_SAFE_INTEGER,
    checkedAt: toDate(d.checkedAt),
  };
}

export function shapeBankAccounts(raw: unknown): BankAccount[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): BankAccount[] => {
    if (!entry || typeof entry !== "object") return [];
    const d = entry as Record<string, unknown>;

    const id = str(d.id);
    const accountNumber = str(d.accountNumber);
    const ifsc = str(d.ifsc);
    // An entry missing any of these cannot be paid into, verified or even
    // shown. Dropped rather than defaulted, exactly as `shapeChecks` drops an
    // unreadable state: a half-record on a payout screen is worse than none.
    if (!id || !accountNumber || !ifsc) return [];

    /*
      An unreadable state becomes `unverified`, never `verified`.

      This is the one default in the file that is chosen rather than dropped: a
      record with a good account number and a corrupt state is still an account
      somebody added, and losing it silently would look like the platform had
      forgotten their bank. Downgrading it costs them a re-check; the other
      direction pays a stranger.
    */
    const state = STATES.includes(d.state as BankVerificationState)
      ? (d.state as BankVerificationState)
      : "unverified";

    return [
      {
        id,
        accountName: str(d.accountName) ?? "",
        bankName: str(d.bankName) ?? "",
        accountNumber,
        ifsc,
        // Only a verified account may be primary. A document that says
        // otherwise — hand-edited, or written by an older version — is not
        // honoured, because `makePrimary` is not the only way bytes reach here.
        primary: d.primary === true && state === "verified",
        state,
        verification: shapeVerification(d.verification),
        addedAt: toDate(d.addedAt) ?? new Date(0),
      },
    ];
  });
}

/** Back to something Firestore will take. `undefined` is not a storable value. */
export function serialiseBankAccounts(
  list: readonly BankAccount[],
): Record<string, unknown>[] {
  return list.map((account) => {
    const verification = account.verification;
    return {
      id: account.id,
      accountName: account.accountName,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      ifsc: account.ifsc,
      primary: account.primary,
      state: account.state,
      addedAt: account.addedAt,
      ...(verification
        ? {
            verification: {
              provider: verification.provider,
              attempts: verification.attempts,
              ...(verification.validationId
                ? { validationId: verification.validationId }
                : {}),
              ...(verification.registeredName
                ? { registeredName: verification.registeredName }
                : {}),
              ...(verification.accountStatus
                ? { accountStatus: verification.accountStatus }
                : {}),
              ...(verification.nameMatch ? { nameMatch: verification.nameMatch } : {}),
              ...(verification.reason ? { reason: verification.reason } : {}),
              ...(verification.checkedAt ? { checkedAt: verification.checkedAt } : {}),
            },
          }
        : {}),
    };
  });
}

/** Which collection this role's account document lives in, if any. */
export function collectionForRole(role: Role): string | null {
  if (!canSelfSignup(role)) return null;
  return COLLECTION_FOR_SIGNUP[role] ?? null;
}

export async function readBankAccounts(
  role: Role,
  accountId: string | undefined,
): Promise<BankAccount[]> {
  const collection = collectionForRole(role);
  if (!collection || !accountId) return [];

  const snapshot = await adminDb().collection(collection).doc(accountId).get();
  if (!snapshot.exists) return [];
  return shapeBankAccounts(snapshot.data()?.bankAccounts);
}

/**
 * Finds the account a validation belongs to, by the reference we sent.
 *
 * The webhook arrives with no session — it is Razorpay talking, not a person —
 * so the only way back to a record is the reference the validation was started
 * with. Encoded as `role:accountId:bankAccountId` because a collection group
 * query across five account collections to find one array entry is not a thing
 * Firestore will do.
 */
export function encodeValidationReference(
  role: Role,
  accountId: string,
  bankAccountId: string,
): string {
  return `${role}:${accountId}:${bankAccountId}`;
}

export function decodeValidationReference(
  reference: string,
): { role: Role; accountId: string; bankAccountId: string } | null {
  const parts = reference.split(":");
  if (parts.length !== 3) return null;
  const [role, accountId, bankAccountId] = parts;
  if (!role || !accountId || !bankAccountId) return null;
  if (!canSelfSignup(role)) return null;
  return { role: role as Role, accountId, bankAccountId };
}
