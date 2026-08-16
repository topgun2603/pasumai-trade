import { requireRole } from "@/lib/api/write-guard";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { activate, isSubscribed, renew } from "@/lib/domain/subscription";
import { adminDb } from "@/lib/firebase/admin";
import { shapeSubscription } from "@/lib/firebase/subscription-read";

/**
 * Confirm that a payment arrived.
 *
 * Operations only. This is the one place a subscription becomes real, and it
 * exists because there is no gateway: somebody at the platform matches a bank
 * transfer against a reference and presses a button. When a gateway lands, its
 * webhook calls this same code path rather than a second one that has to be
 * kept in step.
 *
 * The paid period runs from now, not from when they asked, so the days spent
 * waiting on the transfer are not deducted from what they bought.
 */
export async function POST(request: Request) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  let body: { role?: unknown; accountId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";

  // `canSelfSignup` narrows to the roles that own an account document, which
  // is also exactly the set that can hold a subscription. Operations cannot.
  if (!canSelfSignup(role) || !accountId) {
    return Response.json({ error: "Give a role and an account id." }, { status: 422 });
  }

  const ref = adminDb().collection(COLLECTION_FOR_SIGNUP[role]).doc(accountId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return Response.json({ error: "No such account." }, { status: 404 });
  }

  const existing = shapeSubscription(snapshot.data()!.subscription);
  if (!existing) {
    return Response.json(
      { error: "That account has not asked for a subscription." },
      { status: 409 },
    );
  }

  const now = new Date();

  // Activating twice must not hand out two periods. An already-current
  // subscription is extended by a renewal, which is the honest reading of a
  // second payment against the same reference.
  const next = isSubscribed(existing, now)
    ? renew(existing, now)
    : activate(existing, now);

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
      },
    },
    { merge: true },
  );

  return Response.json({
    accountId,
    status: next.status,
    renewsAt: next.renewsAt.toISOString(),
  });
}
