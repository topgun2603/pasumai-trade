import { randomBytes } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import {
  addBankAccount,
  BankAccountError,
  toPublicBankAccount,
  validateBankAccount,
  type BankAccountInput,
} from "@/lib/domain/bank-accounts";
import { canSelfSignup } from "@/lib/domain/signup";
import { hasAdminCredentials } from "@/lib/firebase/admin";
import { readBankAccounts } from "@/lib/firebase/bank-read";
import { saveBankAccounts } from "@/lib/firebase/bank-write";
import { pennyDropAvailable } from "@/lib/kyc/razorpayx";

/**
 * The bank accounts on the signed-in account.
 *
 * `GET` lists them, `POST` adds one. Neither ever returns a full account
 * number — `toPublicBankAccount` masks to the last four digits, and the whole
 * value is read only inside the verify endpoint, immediately before it is
 * handed to the provider.
 *
 * **The account id is never taken from the request.** It comes off the session
 * claims, like every other endpoint scoped to "your own records". A request
 * body that could name an account is a request body that could add a bank
 * account to somebody else's payouts.
 */

function text(value: unknown, max = 140): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json({ accounts: [], pennyDrop: false });
  }

  const list = await readBankAccounts(role, accountId);
  return Response.json({
    accounts: list.map(toPublicBankAccount),
    // Said out loud so the interface can offer verification or explain its
    // absence, rather than showing a button that always fails.
    pennyDrop: pennyDropAvailable(),
  });
}

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json(
      { error: "Bank details are not configured on this deployment." },
      { status: 503 },
    );
  }

  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json(
      { error: "This account cannot hold bank details." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const input: BankAccountInput = {
    accountName: text(body.accountName),
    bankName: text(body.bankName),
    accountNumber: text(body.accountNumber, 30),
    ifsc: text(body.ifsc, 20),
  };

  /*
    Checked before anything is stored, and long before a penny drop.

    A malformed IFSC is wrong whatever a bank would say about it, and rejecting
    it here costs nothing — where an attempt against the provider costs real
    money out of a budget of three.
  */
  const errors = validateBankAccount(input);
  const failed = Object.entries(errors).filter(([, message]) => message);
  if (failed.length > 0) {
    return Response.json(
      { error: "Check the highlighted fields.", fields: Object.fromEntries(failed) },
      { status: 422 },
    );
  }

  const existing = await readBankAccounts(role, accountId);
  const id = `b_${randomBytes(8).toString("hex")}`;

  let updated;
  try {
    updated = addBankAccount(existing, input, id, new Date());
  } catch (error) {
    if (error instanceof BankAccountError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  await saveBankAccounts(role, accountId, updated);

  const added = updated.find((account) => account.id === id);
  return Response.json(
    {
      account: added ? toPublicBankAccount(added) : null,
      accounts: updated.map(toPublicBankAccount),
    },
    { status: 201 },
  );
}
