import type { Metadata } from "next";
import { connection } from "next/server";

import { SubscribePanel, type SubscriptionView } from "@/components/billing/subscribe-panel";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { formatMoney } from "@/lib/domain/money";
import {
  badgeFor,
  daysRemaining,
  effectiveStatus,
  isLifetime,
  termOption,
  termsFor,
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

  // Whether they have paid before. Franchise pricing turns on it — ₹1.25L the
  // first year, ₹99,000 every year after — so the ladder is priced per account
  // rather than being one fixed list.
  const renewal = subscription?.renewal === true || subscription?.paidAt !== undefined;
  const option = subscription ? termOption(role, subscription.term, renewal) : undefined;
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
        description="Browsing is free. Bargaining and ordering need a plan."
      />
      <div className="flex flex-col gap-6 p-5">
        <SubscribePanel
          options={termsFor(role, renewal)}
          current={current}
          bypassed={paymentsBypassed()}
        />
      </div>
    </>
  );
}
