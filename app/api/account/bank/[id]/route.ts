import { requireSession } from "@/lib/api/write-guard";
import {
  BankAccountError,
  makePrimary,
  removeBankAccount,
  toPublicBankAccount,
} from "@/lib/domain/bank-accounts";
import { canSelfSignup } from "@/lib/domain/signup";
import { readBankAccounts } from "@/lib/firebase/bank-read";
import { saveBankAccounts } from "@/lib/firebase/bank-write";

/**
 * One bank account: choose it, or remove it.
 *
 * `PATCH { primary: true }` moves the payout flag. `DELETE` takes the account
 * off the list. Both refuse an id that is not on *this* session's account, for
 * free — the list is loaded by the session's own account id, so an id belonging
 * to somebody else is simply not in it.
 *
 * The rule that an account must be verified before it can be primary is
 * enforced in `lib/domain/bank-accounts.ts`, not here. This handler only turns
 * the resulting error into a status code, so a second caller written later
 * cannot skip the check by not knowing about it.
 */

async function scope() {
  const gate = await requireSession();
  if (!gate.ok) return { ok: false as const, response: gate.response };

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "This account cannot hold bank details." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, role, accountId };
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/account/bank/[id]">,
) {
  const gate = await scope();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  /*
    One switch, and it only goes one way.

    There is no "make this not primary": an account with no payout destination
    is a state somebody can only reach by removing the account, never by
    unticking a box and forgetting. Choosing a different account is how you
    change it.
  */
  if (body.primary !== true) {
    return Response.json(
      { error: "Send { primary: true } to choose this account." },
      { status: 422 },
    );
  }

  const existing = await readBankAccounts(gate.role, gate.accountId);

  let updated;
  try {
    updated = makePrimary(existing, id);
  } catch (error) {
    if (error instanceof BankAccountError) {
      // 409 rather than 422: the request is well formed, the account is simply
      // not in a state that allows it.
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  await saveBankAccounts(gate.role, gate.accountId, updated);
  return Response.json({ accounts: updated.map(toPublicBankAccount) });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/account/bank/[id]">,
) {
  const gate = await scope();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const existing = await readBankAccounts(gate.role, gate.accountId);

  let updated;
  try {
    updated = removeBankAccount(existing, id);
  } catch (error) {
    if (error instanceof BankAccountError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  await saveBankAccounts(gate.role, gate.accountId, updated);
  return Response.json({ accounts: updated.map(toPublicBankAccount) });
}
