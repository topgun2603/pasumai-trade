import type { Metadata } from "next";
import { connection } from "next/server";

import { SubscribePanel, type SubscriptionView } from "@/components/billing/subscribe-panel";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { formatMoney } from "@/lib/domain/money";
import {
  daysRemaining,
  effectiveStatus,
  planById,
  plansForRole,
} from "@/lib/domain/subscription";
import { readAccountState } from "@/lib/firebase/subscription-read";
import { paymentsBypassed } from "@/lib/payments/bypass";

export const metadata: Metadata = { title: "Subscription · Pasumai Trade" };

/**
 * Where a buyer sees what they are paying for.
 *
 * Everything derived on the server — status against the clock, days left,
 * formatted money — so the panel renders the same before and after hydration.
 * A countdown computed in the browser would differ from the one rendered on
 * the server by however long the request took.
 */
export default async function SubscriptionPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const { role, accountId } = session.claims;
  const now = new Date();

  const state = await readAccountState(role, accountId);
  const subscription = state.subscription;
  const status = effectiveStatus(subscription, now);
  const plan = subscription ? planById(subscription.planId) : undefined;

  const current: SubscriptionView = {
    status,
    planName: plan?.name,
    reference: subscription?.reference,
    amountLabel: subscription ? formatMoney(subscription.amount) : undefined,
    renewsAtLabel: subscription
      ? subscription.renewsAt.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : undefined,
    daysLeft: subscription ? Math.max(0, daysRemaining(subscription, now)) : undefined,
  };

  // Operations have no plans of their own, so they are shown the buyer set —
  // this page is how they see what a buyer sees when one phones about it.
  const plans = plansForRole(role === "admin" ? "buyer" : role);

  return (
    <>
      <PageHeader
        title="Subscription"
        description="Browsing is free. Bargaining and ordering need a plan."
      />
      <div className="flex flex-col gap-6 p-5">
        <SubscribePanel plans={plans} current={current} bypassed={paymentsBypassed()} />
      </div>
    </>
  );
}
