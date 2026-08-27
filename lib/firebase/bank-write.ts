import "server-only";

import type { Role } from "@/lib/auth/claims";
import type { BankAccount } from "@/lib/domain/bank-accounts";

import { adminDb } from "./admin";
import { collectionForRole, serialiseBankAccounts } from "./bank-read";

/**
 * The only place the bank array is written.
 *
 * `merge: true` for the same reason every other writer on an account document
 * uses it: this endpoint owns one field and must not overwrite a subscription
 * or a KYC check that changed between the read and the write.
 *
 * Also updates `bankAccountTail`, which predates this module and is read by the
 * admin console, the farmer record shape and `BankPanel`. Keeping it in step
 * here means nothing else has to know the list exists — and means the tail
 * always names the account that is actually being paid, rather than whichever
 * one operations typed in first.
 */
export async function saveBankAccounts(
  role: Role,
  accountId: string,
  list: readonly BankAccount[],
): Promise<void> {
  const collection = collectionForRole(role);
  if (!collection) throw new Error(`Role ${role} has no account document.`);

  const primary = list.find((account) => account.primary);

  await adminDb()
    .collection(collection)
    .doc(accountId)
    .set(
      {
        bankAccounts: serialiseBankAccounts(list),
        // Empty when nothing is verified. An account with no proved destination
        // should read as having no tail rather than keeping the last one, which
        // would show a payout target that is no longer trusted.
        bankAccountTail: primary ? primary.accountNumber.slice(-4) : "",
      },
      { merge: true },
    );
}
