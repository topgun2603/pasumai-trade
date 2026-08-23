import type { Metadata } from "next";
import { connection } from "next/server";

import { SubscribePanel, type SubscriptionView } from "@/components/billing/subscribe-panel";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { paymentsBypassed } from "@/lib/payments/bypass";
import { formatMoney } from "@/lib/domain/money";
import {
  badgeFor,
  daysRemaining,
  effectiveStatus,
  isLifetime,
  termOption,
  termsFor,
} from "@/lib/domain/subscription";

export const metadata: Metadata = { title: "Subscription · Farmer" };

export default async function FarmSubscriptionPage() {
  await connection();

  const { farmer, email, subscription } = await requireFarmer();
  const now = new Date();

  const renewal = subscription?.renewal === true || subscription?.paidAt !== undefined;
  const option = subscription ? termOption("farmer", subscription.term, renewal) : undefined;
  const lifetime = subscription ? isLifetime(subscription.term) : false;

  const current: SubscriptionView = {
    status: effectiveStatus(subscription, now),
    termLabel: option?.label,
    badge: subscription ? badgeFor(subscription.term) : undefined,
    lifetime,
    reference: subscription?.reference,
    amountLabel: subscription ? formatMoney(subscription.amount) : undefined,
    renewsAtLabel:
      subscription && !lifetime
        ? subscription.renewsAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : undefined,
    daysLeft:
      subscription && !lifetime ? Math.max(0, daysRemaining(subscription, now)) : undefined,
  };

  return (
    <>
      <PageHeader
        title="Subscription"
        description="Looking is free. Posting produce and bargaining need a plan."
      />
      <div className="flex flex-col gap-6 p-5">
        <SubscribePanel
          options={termsFor("farmer", renewal)}
          current={current}
          payer={{ name: farmer.name, email, mobile: farmer.mobile }}
          bypassed={paymentsBypassed()}
        />
      </div>
    </>
  );
}
