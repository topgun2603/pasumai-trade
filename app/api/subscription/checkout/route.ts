import { randomBytes } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import {
  isSubscribed,
  planById,
  priceFor,
  requestSubscription,
  subscriptionReference,
  type BillingPeriod,
} from "@/lib/domain/subscription";
import { adminDb } from "@/lib/firebase/admin";
import { readAccountState } from "@/lib/firebase/subscription-read";
import { createOrder, isTestKey, razorpayConfig } from "@/lib/payments/razorpay";

/**
 * Opens a checkout.
 *
 * Creates a Razorpay order for the plan price and returns what the browser
 * needs to open the modal. It grants nothing: the subscription is written as
 * `requested` and only becomes active when a signature comes back that could
 * only have been produced by Razorpay.
 *
 * The price is looked up here from the plan id. It is never taken from the
 * request — a body naming its own amount is a body that pays ₹1 for a year.
 */
export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const config = razorpayConfig();
  if (!config) {
    return Response.json(
      { error: "Card payment is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json(
      { error: "This account does not take a subscription." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const plan = planById(typeof body.planId === "string" ? body.planId : "");
  if (!plan) return Response.json({ error: "Unknown plan." }, { status: 422 });
  if (plan.role !== role) {
    return Response.json(
      { error: "That plan is not for this kind of account." },
      { status: 422 },
    );
  }

  const period: BillingPeriod = body.period === "yearly" ? "yearly" : "monthly";
  const amount = priceFor(plan, period);

  const state = await readAccountState(role, accountId);
  if (!state.exists) return Response.json({ error: "Account not found." }, { status: 404 });
  if (state.blocked) {
    return Response.json(
      { error: "Your account is on hold. Operations will have been in touch." },
      { status: 403 },
    );
  }

  const now = new Date();
  if (isSubscribed(state.subscription, now)) {
    // Already paid and current. Refused rather than charged again — a double
    // click on Subscribe must not cost a month.
    return Response.json(
      { error: "That subscription is already running.", alreadyActive: true },
      { status: 409 },
    );
  }

  const reference =
    state.subscription?.planId === plan.id && state.subscription.reference
      ? state.subscription.reference
      : subscriptionReference(randomBytes(8).toString("hex"));

  let order;
  try {
    order = await createOrder(config, {
      amount,
      receipt: reference,
      // Echoed back on the webhook, which is how a payment completed after the
      // browser was closed still knows whose subscription to start.
      notes: { accountId, role, planId: plan.id, period, reference },
    });
  } catch (error) {
    console.error("razorpay order failed", error);
    return Response.json(
      { error: "Could not start the payment. Try again in a moment." },
      { status: 502 },
    );
  }

  const requested = requestSubscription(plan, period, reference, now);

  await adminDb().collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId).set(
    {
      subscription: {
        planId: requested.planId,
        status: requested.status,
        startedAt: requested.startedAt,
        renewsAt: requested.renewsAt,
        paidAt: null,
        reference: requested.reference,
        amount: requested.amount,
        period: requested.period,
        // Stored so verify and the webhook can both check that the payment
        // coming back belongs to the order this account actually opened.
        razorpayOrderId: order.id,
      },
    },
    { merge: true },
  );

  return Response.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    // The key id is a public identifier — it ships in the checkout script by
    // design. The secret never leaves the server.
    keyId: config.keyId,
    testMode: isTestKey(config.keyId),
    planName: plan.name,
    reference,
  });
}
