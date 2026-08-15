import type { Metadata } from "next";
import { connection } from "next/server";

import { SubscribePanel, type SubscriptionView } from "@/components/billing/subscribe-panel";
import { PageHeader } from "@/components/page-header";
import { requireAgency } from "@/lib/auth/agency";
import { verifySession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import {
  daysRemaining,
  effectiveStatus,
  planById,
  plansForRole,
} from "@/lib/domain/subscription";
import { readAccountState } from "@/lib/firebase/subscription-read";

export const metadata: Metadata = { title: "Subscription · Agency" };

/**
 * The agency's own billing page.
 *
 * Deliberately a separate route from the buyer one rather than a shared page
 * behind a role check: the two consoles have different shells, and the plans,
 * the wording and what the subscription unlocks all differ. Same reasoning as
 * keeping the six logins apart.
 */
export default async function AgencySubscriptionPage() {
  await connection();

  const { agency } = await requireAgency();
  const session = await verifySession();
  const role = session!.claims.role;
  const now = new Date();

  const state = await readAccountState(role, agency.id);
  const subscription = state.subscription;
  const plan = subscription ? planById(subscription.planId) : undefined;

  const current: SubscriptionView = {
    status: effectiveStatus(subscription, now),
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

  return (
    <>
      <PageHeader
        title="Subscription"
        description={
          role === "transport"
            ? "Browsing is free. Adding vehicles and taking dispatch jobs need a plan."
            : "Browsing is free. Adding workers and taking jobs need a plan."
        }
      />
      <div className="flex flex-col gap-6 p-5">
        <SubscribePanel plans={plansForRole(role)} current={current} />
      </div>
    </>
  );
}
