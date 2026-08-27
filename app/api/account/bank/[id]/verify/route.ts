import { requireSession } from "@/lib/api/write-guard";
import {
  applyVerification,
  canAttemptVerification,
  markVerificationPending,
  recordValidationId,
  toPublicBankAccount,
  MAX_VERIFY_ATTEMPTS,
} from "@/lib/domain/bank-accounts";
import { canSelfSignup } from "@/lib/domain/signup";
import {
  encodeValidationReference,
  readBankAccounts,
} from "@/lib/firebase/bank-read";
import { saveBankAccounts } from "@/lib/firebase/bank-write";
import {
  fetchValidation,
  razorpayxConfig,
  startBankValidation,
} from "@/lib/kyc/razorpayx";

/**
 * Proving one bank account with a penny drop.
 *
 * `POST` starts a check. `GET` asks the provider how an outstanding one went,
 * for the case the webhook is not configured yet or a screen was left open.
 *
 * ## The attempt is reserved before the money is spent
 *
 * The order below matters and is not the obvious one. The attempt is counted
 * and written to Firestore *before* the provider is called, not after. A
 * double-clicked button, a retried fetch on a flaky village connection, or two
 * tabs open on the same page would otherwise each buy their own penny drop —
 * and the platform pays for every one. Reserving first means the second request
 * finds the account already `pending` and is turned away by
 * `canAttemptVerification`.
 *
 * The cost of that ordering is an attempt burned when the provider cannot be
 * reached at all. That is the right way round: a wasted try out of three is
 * cheaper than an unbounded spend, and the failure is recorded with a reason
 * rather than vanishing.
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

export async function POST(
  _request: Request,
  context: RouteContext<"/api/account/bank/[id]/verify">,
) {
  const gate = await scope();
  if (!gate.ok) return gate.response;

  const config = razorpayxConfig();
  if (!config) {
    /*
      Not configured is not a failure of the applicant's, and it must never read
      as one. 503 and a plain sentence, so the interface can send them down the
      manual road — the same contract `lib/kyc/provider.ts` describes for every
      other check.
    */
    return Response.json(
      {
        error:
          "Instant bank verification is not switched on for this site yet. Operations will check this account by hand.",
        code: "notConfigured",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const existing = await readBankAccounts(gate.role, gate.accountId);
  const account = existing.find((entry) => entry.id === id);

  if (!account) {
    return Response.json({ error: "No such bank account." }, { status: 404 });
  }
  if (account.state === "verified") {
    return Response.json(
      { error: "This account is already verified." },
      { status: 409 },
    );
  }
  if (account.state === "pending") {
    return Response.json(
      { error: "A check on this account is already running." },
      { status: 409 },
    );
  }
  if (!canAttemptVerification(account)) {
    return Response.json(
      {
        error: `This account has been checked ${MAX_VERIFY_ATTEMPTS} times without success. Operations will look at it by hand.`,
        code: "attemptsExhausted",
      },
      { status: 429 },
    );
  }

  const now = new Date();
  const reference = encodeValidationReference(gate.role, gate.accountId, id);

  // Reserved first. See the header — this is what stops a double click buying
  // two penny drops.
  const reserved = markVerificationPending(existing, id, reference, now);
  await saveBankAccounts(gate.role, gate.accountId, reserved);

  const started = await startBankValidation(config, {
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ifsc: account.ifsc,
    reference,
    contactName: account.accountName,
  });

  if (!started.ok) {
    // Recorded as a failed attempt rather than rolled back to `unverified`.
    // The money was spent — or may have been — and a record saying nothing
    // happened would invite an immediate retry.
    const failed = applyVerification(
      reserved,
      id,
      { provider: "razorpayx", reason: started.error },
      new Date(),
    );
    await saveBankAccounts(gate.role, gate.accountId, failed);
    return Response.json(
      { error: started.error, accounts: failed.map(toPublicBankAccount) },
      { status: 502 },
    );
  }

  /*
    Usually still running, and the webhook brings the answer. Where the provider
    settled inside the same call, it is recorded now so somebody watching the
    screen gets a result without waiting for a round trip they cannot see.
  */
  const updated = started.outcome
    ? applyVerification(reserved, id, started.outcome, new Date())
    : recordValidationId(reserved, id, started.validationId ?? reference);

  await saveBankAccounts(gate.role, gate.accountId, updated);

  const after = updated.find((entry) => entry.id === id);
  return Response.json({
    account: after ? toPublicBankAccount(after) : null,
    accounts: updated.map(toPublicBankAccount),
    settled: Boolean(started.outcome),
  });
}

/**
 * Asks the provider again about a check still in flight.
 *
 * The webhook is the authority — same argument as payments, in the header of
 * `app/api/webhooks/razorpay/route.ts`. This is the fallback that keeps a
 * screen from sitting on "Checking…" forever when no webhook is configured.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/account/bank/[id]/verify">,
) {
  const gate = await scope();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const existing = await readBankAccounts(gate.role, gate.accountId);
  const account = existing.find((entry) => entry.id === id);

  if (!account) {
    return Response.json({ error: "No such bank account." }, { status: 404 });
  }

  const config = razorpayxConfig();
  const validationId = account.verification?.validationId;

  // Nothing outstanding, or nothing to ask. Answer with what is on file rather
  // than an error: the caller is polling, and a 4xx would look like a bug.
  if (account.state !== "pending" || !config || !validationId) {
    return Response.json({
      account: toPublicBankAccount(account),
      accounts: existing.map(toPublicBankAccount),
      settled: account.state !== "pending",
    });
  }

  const result = await fetchValidation(config, validationId);
  if (!result.settled || !result.outcome) {
    return Response.json({
      account: toPublicBankAccount(account),
      accounts: existing.map(toPublicBankAccount),
      settled: false,
    });
  }

  const updated = applyVerification(existing, id, result.outcome, new Date());
  await saveBankAccounts(gate.role, gate.accountId, updated);

  const after = updated.find((entry) => entry.id === id);
  return Response.json({
    account: after ? toPublicBankAccount(after) : null,
    accounts: updated.map(toPublicBankAccount),
    settled: true,
  });
}
