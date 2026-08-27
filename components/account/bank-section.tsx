import { verifySession } from "@/lib/auth/session";
import { toPublicBankAccount } from "@/lib/domain/bank-accounts";
import { canSelfSignup } from "@/lib/domain/signup";
import { readBankAccounts } from "@/lib/firebase/bank-read";
import { pennyDropAvailable } from "@/lib/kyc/razorpayx";

import { BankAccounts } from "./bank-accounts";

/**
 * The bank section, loaded for whoever is signed in.
 *
 * A server component rather than three copies of the same six lines in the
 * farm, buying and agency pages. Each of those has already run its own guard
 * before this renders — this reads the session only to learn *which* account to
 * load, never to decide whether it may be loaded.
 *
 * The account id comes off the claims and is never a prop. A page that could
 * pass one would be a page that could be made to render somebody else's bank
 * details by changing a URL.
 *
 * Operations get nothing here. An admin session carries no `accountId`, and the
 * read-only view of every account's details already exists in `/admin` — this
 * page is the one where a person changes their own.
 */
export async function BankSection() {
  const session = await verifySession();
  const role = session?.claims.role;
  const accountId = session?.claims.accountId;

  if (!role || !canSelfSignup(role) || !accountId) {
    return (
      <p className="text-muted-foreground max-w-prose text-sm">
        This account does not hold its own bank details.
      </p>
    );
  }

  const accounts = await readBankAccounts(role, accountId);

  return (
    <BankAccounts
      initialAccounts={accounts.map(toPublicBankAccount)}
      pennyDrop={pennyDropAvailable()}
    />
  );
}
