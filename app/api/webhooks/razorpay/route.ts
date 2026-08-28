import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { applyGatewayPayment } from "@/lib/domain/subscription";
import { adminDb } from "@/lib/firebase/admin";
import { shapeSubscription } from "@/lib/firebase/subscription-read";
import { razorpayConfig, verifyWebhookSignature } from "@/lib/payments/razorpay";

/**
 * Razorpay's own account of what happened.
 *
 * The verify endpoint depends on the browser coming back. It routinely does
 * not: the tab is closed on the success screen, the phone loses signal during
 * a UPI approval, the app switches away and never returns. Every one of those
 * is a customer who has paid and has nothing, and no amount of care in the
 * browser fixes it because the browser is gone.
 *
 * So this is the authority and the redirect is the optimisation. It is
 * unauthenticated by necessity — Razorpay holds no session — and trusted only
 * because of the signature over the raw body.
 *
 * Idempotent: the same event can and does arrive more than once, and an
 * already-current subscription is extended by `renew` rather than granted a
 * second fresh period.
 */

interface WebhookPayment {
  readonly id?: string;
  readonly order_id?: string;
  readonly amount?: number;
  readonly status?: string;
  readonly method?: string;
  readonly notes?: Record<string, string>;
}

export async function POST(request: Request) {
  const config = razorpayConfig();
  if (!config?.webhookSecret) {
    // Not configured is not an error worth retrying, and answering 200 stops
    // Razorpay backing off against an endpoint that will never work.
    return Response.json({ ignored: "no webhook secret configured" });
  }

  // The exact bytes. Re-serialising a parsed object reorders keys and breaks
  // the signature for reasons that look like an attack.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(config.webhookSecret, raw, signature)) {
    console.warn("razorpay webhook signature rejected");
    return Response.json({ error: "Bad signature." }, { status: 400 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: WebhookPayment } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (event.event !== "payment.captured") {
    // Acknowledged, not acted on. Returning an error would make Razorpay retry
    // an event this endpoint has no interest in, forever.
    return Response.json({ ignored: event.event ?? "unknown" });
  }

  const payment = event.payload?.payment?.entity;
  const notes = payment?.notes ?? {};
  const accountId = notes.accountId;
  const role = notes.role;

  // The notes were set when the order was created, server-side, so they are as
  // trustworthy as the signature that carried them here.
  if (!accountId || !role || !canSelfSignup(role)) {
    console.warn("razorpay webhook with no usable notes", { paymentId: payment?.id });
    return Response.json({ ignored: "no account in notes" });
  }

  const ref = adminDb().collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    console.warn("razorpay webhook for missing account", { accountId });
    return Response.json({ ignored: "account not found" });
  }

  const stored = snapshot.data()!.subscription as Record<string, unknown> | undefined;
  const existing = shapeSubscription(stored);
  if (!existing) return Response.json({ ignored: "no subscription started" });

  if (payment?.order_id && stored?.razorpayOrderId !== payment.order_id) {
    console.warn("razorpay webhook order mismatch", { accountId });
    return Response.json({ ignored: "order mismatch" });
  }

  if (payment?.amount !== existing.amount.minorUnits) {
    console.warn("razorpay webhook amount mismatch", {
      accountId,
      paid: payment?.amount,
      owed: existing.amount.minorUnits,
    });
    return Response.json({ ignored: "amount mismatch" });
  }

  const now = new Date();

  /*
    Already active because verify got there first. Nothing to do, and saying so
    is not a failure.

    The check moved into `applyGatewayPayment` so that this endpoint and the
    verify endpoint cannot disagree about it — they did, and the one without it
    was renewing a subscription the other had just activated.
  */
  const applied = applyGatewayPayment(
    existing,
    payment?.id,
    typeof stored?.razorpayPaymentId === "string" ? stored.razorpayPaymentId : null,
    now,
  );

  if (applied.alreadyApplied) {
    return Response.json({ ok: true, alreadyActivated: true });
  }

  const next = applied.next;

  await ref.set(
    {
      subscription: {
        planId: next.planId,
        status: next.status,
        startedAt: next.startedAt,
        renewsAt: next.renewsAt,
        paidAt: next.paidAt ?? now,
        reference: next.reference,
        amount: next.amount,
        term: next.term,
        renewal: next.renewal ?? false,
        razorpayOrderId: payment?.order_id ?? stored?.razorpayOrderId ?? null,
        razorpayPaymentId: payment?.id ?? null,
        paymentMethod: payment?.method ?? null,
      },
    },
    { merge: true },
  );

  return Response.json({ ok: true, accountId, status: next.status });
}
