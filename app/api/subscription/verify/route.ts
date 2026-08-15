import { requireSession } from "@/lib/api/write-guard";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { activate, isSubscribed, renew } from "@/lib/domain/subscription";
import { adminDb } from "@/lib/firebase/admin";
import { shapeSubscription } from "@/lib/firebase/subscription-read";
import { fetchPayment, razorpayConfig, verifyCheckoutSignature } from "@/lib/payments/razorpay";

/**
 * Turns a completed checkout into an active subscription.
 *
 * The browser saying "it worked" is worth nothing on its own — this endpoint is
 * reachable by anyone with a session and any order id they care to invent. Four
 * things are checked before a single day of access is granted:
 *
 *   1. the signature, which only the holder of the key secret could produce;
 *   2. that the order id matches the one *this account* opened, so a real
 *      signature from somebody else's payment cannot be replayed here;
 *   3. that Razorpay itself reports the payment captured, asked directly
 *      rather than taken from the request;
 *   4. that the amount paid equals the amount the order was for.
 *
 * Any one of those failing means no subscription.
 */
export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const config = razorpayConfig();
  if (!config) {
    return Response.json({ error: "Payment is not configured." }, { status: 503 });
  }

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json({ error: "No subscription on this account." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (!orderId || !paymentId || !signature) {
    return Response.json({ error: "Incomplete payment details." }, { status: 422 });
  }

  // (1) Only Razorpay can produce this.
  if (!verifyCheckoutSignature(config, { orderId, paymentId, signature })) {
    console.warn("razorpay signature rejected", { accountId, orderId });
    return Response.json({ error: "That payment could not be verified." }, { status: 400 });
  }

  const ref = adminDb().collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return Response.json({ error: "Account not found." }, { status: 404 });
  }

  const stored = snapshot.data()!.subscription as Record<string, unknown> | undefined;
  const existing = shapeSubscription(stored);
  if (!existing) {
    return Response.json({ error: "No subscription was started." }, { status: 409 });
  }

  // (2) A valid signature for somebody else's order is still not this account's
  // payment. Without this check, one real payment could activate every account.
  if (stored?.razorpayOrderId !== orderId) {
    console.warn("razorpay order mismatch", { accountId, orderId });
    return Response.json({ error: "That payment is for a different order." }, { status: 409 });
  }

  // (3) Asked of Razorpay directly rather than believed from the body.
  const payment = await fetchPayment(config, paymentId);
  if (!payment || payment.order_id !== orderId) {
    return Response.json({ error: "That payment could not be found." }, { status: 400 });
  }
  if (payment.status !== "captured" && payment.status !== "authorized") {
    return Response.json(
      { error: `Payment is ${payment.status}. Nothing has been charged.` },
      { status: 409 },
    );
  }

  // (4) The amount actually paid, against the amount owed.
  if (payment.amount !== existing.amount.minorUnits) {
    console.warn("razorpay amount mismatch", {
      accountId,
      paid: payment.amount,
      owed: existing.amount.minorUnits,
    });
    return Response.json({ error: "That payment does not match the plan price." }, { status: 409 });
  }

  const now = new Date();
  // Extending rather than replacing when something is already running, so a
  // retried verification cannot cost days.
  const next = isSubscribed(existing, now) ? renew(existing, now) : activate(existing, now);

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
        period: next.period,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        paymentMethod: payment.method ?? null,
      },
    },
    { merge: true },
  );

  return Response.json({
    status: next.status,
    renewsAt: next.renewsAt.toISOString(),
    paymentId,
  });
}
