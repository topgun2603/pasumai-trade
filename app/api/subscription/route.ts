import { randomBytes } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import {
  effectiveStatus,
  isSubscribed,
  planById,
  requestSubscription,
  subscriptionReference,
  type BillingPeriod,
} from "@/lib/domain/subscription";
import { adminDb } from "@/lib/firebase/admin";
import { readAccountState } from "@/lib/firebase/subscription-read";

/**
 * Ask for a subscription.
 *
 * This does not take money, and it is important that it does not pretend to.
 * There is no payment gateway wired up, so what it creates is a `requested`
 * record carrying an amount and a reference. Operations confirm the transfer
 * and activate it. Anything else would be the code asserting a payment it has
 * no way to observe — and the account would be trading on it.
 *
 * When a gateway does land, the shape does not change: the webhook calls the
 * same `activate` the operations button calls today.
 */
export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;

  // Operations have no account to bill and every capability already.
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
  if (!plan) {
    return Response.json({ error: "Unknown plan." }, { status: 422 });
  }

  // The plan has to be one sold to this role. Otherwise a farmer could request
  // the ₹99 grower plan and be granted a buyer's capabilities by the plan id
  // alone — capabilities come from the role, but the price would be wrong and
  // the record would be a lie about what was bought.
  if (plan.role !== role) {
    return Response.json(
      { error: "That plan is not for this kind of account." },
      { status: 422 },
    );
  }

  const period: BillingPeriod = body.period === "yearly" ? "yearly" : "monthly";

  const state = await readAccountState(role, accountId);
  if (!state.exists) {
    return Response.json({ error: "Account not found." }, { status: 404 });
  }
  if (state.blocked) {
    return Response.json(
      { error: "Your account is on hold. Operations will have been in touch." },
      { status: 403 },
    );
  }

  const now = new Date();

  // Already paid and current: this is a renewal, and it extends from the end
  // date rather than replacing it. Charging someone who clicks subscribe twice
  // for a fresh period would cost them the days they had left.
  if (isSubscribed(state.subscription, now) && state.subscription) {
    return Response.json({
      status: effectiveStatus(state.subscription, now),
      alreadyActive: true,
      renewsAt: state.subscription.renewsAt.toISOString(),
      reference: state.subscription.reference,
    });
  }

  // A lapsed subscription on the same plan keeps its reference, so the person
  // paying quotes the one they already have written down.
  const reference =
    state.subscription && state.subscription.planId === plan.id && state.subscription.reference
      ? state.subscription.reference
      : subscriptionReference(randomBytes(8).toString("hex"));

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
      },
    },
    { merge: true },
  );

  return Response.json(
    {
      status: requested.status,
      reference: requested.reference,
      amount: requested.amount,
      period: requested.period,
      planId: requested.planId,
    },
    { status: 201 },
  );
}
