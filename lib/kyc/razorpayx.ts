import "server-only";

import type { VerificationOutcome } from "@/lib/domain/bank-accounts";

/**
 * Penny drop, through RazorpayX.
 *
 * ## This is not the Razorpay you already have
 *
 * `lib/payments/razorpay.ts` holds payment-gateway keys — `rzp_live_…`, used
 * for orders and subscriptions. Account validation lives under RazorpayX,
 * Razorpay's business-banking product, behind a separate onboarding and a
 * separate key pair. Reusing `RAZORPAY_KEY_ID` here would fail with an
 * authentication error that reads like a typo, so the variables are named
 * apart and this module never touches the gateway config.
 *
 * ## What it can and cannot tell you
 *
 * A penny drop proves an account number and IFSC resolve to a real account that
 * accepts money, and returns the name the bank holds against it. It does not
 * prove the account belongs to your applicant — that is the name comparison in
 * `lib/domain/name-match.ts`, and it is the part that actually verifies
 * anything.
 *
 * ## Three constraints worth knowing before you debug this
 *
 *  - **No test mode.** Account validation is live-only. There is no sandbox in
 *    which to exercise the happy path, which is why everything decidable is
 *    decided in the domain modules that *can* be tested and this file is kept
 *    as thin as it can be.
 *  - **IP allowlisting.** RazorpayX requires the calling IPs to be allowlisted.
 *    Serverless functions do not have stable egress addresses on every plan,
 *    and a request from an unlisted address is refused in a way that looks like
 *    bad credentials.
 *  - **It costs money per attempt.** `MAX_VERIFY_ATTEMPTS` in
 *    `lib/domain/bank-accounts.ts` is a spend limit as much as a sanity one.
 */

const API = "https://api.razorpay.com/v1";

export interface RazorpayXConfig {
  readonly keyId: string;
  readonly keySecret: string;
  /** The RazorpayX account the ₹1 is debited from. */
  readonly sourceAccountNumber: string;
  readonly webhookSecret?: string;
}

/**
 * Returns null rather than throwing, so a deployment without RazorpayX
 * degrades to "verification unavailable, use the manual road" instead of a 500
 * on a page somebody opened to read their account number.
 *
 * This is the same contract `lib/kyc/provider.ts` describes: the honest
 * behaviour when nothing is configured is to say so, never to invent a pass.
 */
export function razorpayxConfig(): RazorpayXConfig | null {
  const keyId = process.env.RAZORPAYX_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET;
  const sourceAccountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!keyId || !keySecret || !sourceAccountNumber) return null;
  return {
    keyId,
    keySecret,
    sourceAccountNumber,
    webhookSecret: process.env.RAZORPAYX_WEBHOOK_SECRET,
  };
}

export function pennyDropAvailable(): boolean {
  return razorpayxConfig() !== null;
}

function authHeader(config: RazorpayXConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

/**
 * How hard to try.
 *
 * `optimized` lets Razorpay choose between a real ₹1 transfer and a bank-API
 * lookup that moves no money. For onboarding farmers at volume that is the
 * right default: same answer, materially cheaper, and it does not depend on the
 * beneficiary bank's IMPS being up. `pennydrop` forces the transfer and is
 * worth reaching for only when a bank keeps returning nothing.
 */
export type ValidationType = "optimized" | "pennydrop" | "penniless";

export interface ValidationStarted {
  readonly ok: boolean;
  readonly validationId?: string;
  /** Present when the provider answered synchronously, which it sometimes does. */
  readonly outcome?: VerificationOutcome;
  readonly error?: string;
}

export interface BankAccountToValidate {
  readonly accountName: string;
  readonly accountNumber: string;
  readonly ifsc: string;
  /** Ours, echoed back on the webhook so a reply can be matched to a record. */
  readonly reference: string;
  readonly contactName: string;
}

/**
 * The provider's reply, in whichever shape it arrives.
 *
 * Razorpay documents the results under `validation_results` on the composite
 * endpoint and `results` on the older one, and which you get depends on how the
 * account was onboarded. Reading both costs one line and removes an entire
 * class of "verified nothing because the field was named differently" bug —
 * which, on this path, would silently mark every account failed.
 */
interface ValidationResponse {
  id?: string;
  status?: string;
  validation_results?: { account_status?: string | null; registered_name?: string | null };
  results?: { account_status?: string | null; registered_name?: string | null };
  error?: { description?: string };
}

function readResults(body: ValidationResponse): {
  accountStatus?: "active" | "invalid";
  registeredName?: string;
} {
  const results = body.validation_results ?? body.results;
  const status = results?.account_status;
  const name = results?.registered_name;
  return {
    // Anything that is not the literal `active` is treated as not active. A
    // null here is Razorpay's way of saying the account could not be resolved,
    // so it must not be read as "unknown, try again later".
    accountStatus:
      status === "active" ? "active" : status === "invalid" ? "invalid" : undefined,
    registeredName: typeof name === "string" && name.trim() !== "" ? name : undefined,
  };
}

/** Whether the provider has finished with this validation, whatever the answer. */
export function isSettled(status: string | undefined): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Turns a settled response into something the domain can record.
 *
 * A `failed` status is a technical failure — the beneficiary bank has IMPS off,
 * or the request could not be placed. That is deliberately *not* reported as an
 * invalid account: telling somebody their account does not exist because a bank
 * was down would send them to change a bank account that was fine.
 */
export function readOutcome(body: ValidationResponse): VerificationOutcome {
  const { accountStatus, registeredName } = readResults(body);

  if (body.status === "failed") {
    return {
      provider: "razorpayx",
      validationId: body.id,
      reason:
        body.error?.description ??
        "The bank could not be reached for this check. Try again in a while.",
    };
  }

  return {
    provider: "razorpayx",
    validationId: body.id,
    accountStatus,
    registeredName,
    reason:
      accountStatus === "invalid"
        ? "The bank does not recognise this account number and IFSC."
        : accountStatus === undefined
          ? "The bank returned no details for this account."
          : undefined,
  };
}

/**
 * Starts a validation.
 *
 * Asynchronous by nature — the usual reply is `created`, and the answer arrives
 * on the webhook. Where the provider does settle in the same call, the outcome
 * comes back with it so a farmer watching the screen gets an answer without
 * waiting for a round trip nobody can see.
 */
export async function startBankValidation(
  config: RazorpayXConfig,
  account: BankAccountToValidate,
  validationType: ValidationType = "optimized",
): Promise<ValidationStarted> {
  let response: Response;
  try {
    response = await fetch(`${API}/fund_accounts/validations`, {
      method: "POST",
      headers: {
        authorization: authHeader(config),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        source_account_number: config.sourceAccountNumber,
        validation_type: validationType,
        fund_account: {
          account_type: "bank_account",
          bank_account: {
            name: account.accountName,
            ifsc: account.ifsc,
            account_number: account.accountNumber,
          },
          contact: {
            name: account.contactName,
            type: "customer",
            // Ours. Razorpay echoes it on the webhook, which is what lets a
            // reply arriving with no browser attached find its record.
            reference_id: account.reference,
          },
        },
        notes: { reference: account.reference },
      }),
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach the verification service. Try again in a while.",
    };
  }

  const body = (await response.json().catch(() => ({}))) as ValidationResponse;

  if (!response.ok) {
    return {
      ok: false,
      error:
        body.error?.description ??
        "The verification service refused the request.",
    };
  }

  if (!body.id) {
    return { ok: false, error: "The verification service returned no reference." };
  }

  return {
    ok: true,
    validationId: body.id,
    outcome: isSettled(body.status) ? readOutcome(body) : undefined,
  };
}

/**
 * Asks again.
 *
 * The webhook is the authority, exactly as it is for payments — see the header
 * of `app/api/webhooks/razorpay/route.ts`. This exists for the case the webhook
 * is not configured yet, and so a screen left open can resolve itself rather
 * than sitting on "Checking…" forever.
 */
export async function fetchValidation(
  config: RazorpayXConfig,
  validationId: string,
): Promise<{ settled: boolean; outcome?: VerificationOutcome }> {
  let response: Response;
  try {
    response = await fetch(`${API}/fund_accounts/validations/${validationId}`, {
      headers: { authorization: authHeader(config) },
    });
  } catch {
    return { settled: false };
  }

  if (!response.ok) return { settled: false };

  const body = (await response.json().catch(() => ({}))) as ValidationResponse;
  if (!isSettled(body.status)) return { settled: false };

  return { settled: true, outcome: readOutcome(body) };
}
