import type { Metadata } from "next";
import { connection } from "next/server";

import { SubscribePanel, type SubscriptionView } from "@/components/billing/subscribe-panel";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { paymentsBypassed } from "@/lib/payments/bypass";
import { formatMoney } from "@/lib/domain/money";
import {
  daysRemaining,
  effectiveStatus,
  planById,
  plansForRole,
} from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Subscription · Farmer" };

export default async function FarmSubscriptionPage() {
  await connection();

  const { farmer, email, subscription } = await requireFarmer();
  const now = new Date();
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
        description="Looking is free. Posting produce and bargaining need a plan."
      />
      <div className="flex flex-col gap-6 p-5">
        <SubscribePanel
          plans={plansForRole("farmer")}
          current={current}
          payer={{ name: farmer.name, email, mobile: farmer.mobile }}
          bypassed={paymentsBypassed()}
        />
      </div>
    </>
  );
}
