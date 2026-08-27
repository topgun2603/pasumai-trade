import {
  applyVerification,
  type VerificationOutcome,
} from "@/lib/domain/bank-accounts";
import {
  decodeValidationReference,
  readBankAccounts,
} from "@/lib/firebase/bank-read";
import { saveBankAccounts } from "@/lib/firebase/bank-write";
import { razorpayxConfig, readOutcome } from "@/lib/kyc/razorpayx";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

/**
 * How a penny drop actually comes back.
 *
 * Separate from `/api/webhooks/razorpay` and deliberately so. That endpoint is
 * the payment gateway's; this is RazorpayX's. They are different products with
 * different dashboards, different key pairs and — the part that would bite —
 * different webhook secrets. One endpoint checking two secrets would either
 * accept a signature from the wrong product or reject a valid one, and the
 * failure would land on the payment path, which is the last place to put a
 * change that does not need to be there.
 *
 * Everything the payments webhook's header says applies here too: it is the
 * authority and the polling `GET` is the optimisation. A validation can take
 * minutes, the applicant closes the tab, and the answer still has to land.
 *
 * Unauthenticated by necessity — Razorpay holds no session — and trusted only
 * because of the HMAC over the raw bytes.
 */

interface ValidationEntity {
  id?: string;
  status?: string;
  validation_results?: { account_status?: string | null; registered_name?: string | null };
  results?: { account_status?: string | null; registered_name?: string | null };
  error?: { description?: string };
  notes?: Record<string, unknown>;
  fund_account?: { contact?: { reference_id?: string } };
}

/**
 * Our own reference, out of wherever Razorpay put it.
 *
 * It is sent in two places on the way out — `notes.reference` and the contact's
 * `reference_id` — and which of them survives depends on the endpoint variant
 * the account is onboarded to. Reading both is one line and removes the failure
 * where a verified account can never be matched back to its record.
 */
function referenceOf(entity: ValidationEntity): string | null {
  const fromNotes = entity.notes?.reference;
  if (typeof fromNotes === "string" && fromNotes !== "") return fromNotes;

  const fromContact = entity.fund_account?.contact?.reference_id;
  if (typeof fromContact === "string" && fromContact !== "") return fromContact;

  return null;
}

export async function POST(request: Request) {
  const config = razorpayxConfig();
  if (!config?.webhookSecret) {
    // Not configured is not an error worth retrying. 200 stops Razorpay backing
    // off against an endpoint that will never work — same reasoning as the
    // payments webhook.
    return Response.json({ ignored: "no RazorpayX webhook secret configured" });
  }

  // The exact bytes. Re-serialising a parsed object reorders keys and breaks
  // the signature for reasons that look like an attack.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(config.webhookSecret, raw, signature)) {
    console.warn("razorpayx webhook signature rejected");
    return Response.json({ error: "Bad signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { "fund_account.validation"?: { entity?: ValidationEntity } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!event.event?.startsWith("fund_account.validation")) {
    // Acknowledged, not acted on. An error here would make Razorpay retry an
    // event this endpoint will never care about.
    return Response.json({ ignored: event.event ?? "unknown" });
  }

  const entity = event.payload?.["fund_account.validation"]?.entity;
  if (!entity) return Response.json({ ignored: "no entity" });

  const reference = referenceOf(entity);
  const target = reference ? decodeValidationReference(reference) : null;
  if (!target) {
    // Nothing to do and nothing to retry — a validation we cannot place is not
    // going to become placeable on a second delivery.
    console.warn("razorpayx validation with no usable reference", entity.id);
    return Response.json({ ignored: "no reference" });
  }

  const existing = await readBankAccounts(target.role, target.accountId);
  const account = existing.find((entry) => entry.id === target.bankAccountId);
  if (!account) return Response.json({ ignored: "no such account" });

  /*
    Idempotent, because the same event does arrive more than once.

    An account already settled is left exactly as it is. Re-applying would be
    mostly harmless, but a redelivery arriving after an operator resolved a
    `mismatch` by hand would quietly undo their decision — and that is the one
    outcome nobody would think to look for.
  */
  if (account.state !== "pending") {
    return Response.json({ ignored: "already settled", state: account.state });
  }

  const outcome: VerificationOutcome = readOutcome({
    id: entity.id,
    status: entity.status,
    validation_results: entity.validation_results,
    results: entity.results,
    error: entity.error,
  });

  const updated = applyVerification(
    existing,
    target.bankAccountId,
    outcome,
    new Date(),
  );
  await saveBankAccounts(target.role, target.accountId, updated);

  const after = updated.find((entry) => entry.id === target.bankAccountId);
  return Response.json({ ok: true, state: after?.state });
}
