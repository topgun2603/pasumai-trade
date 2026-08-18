import { BanknoteIcon, ClockIcon, InfinityIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import {
  SubscriptionsTable,
  type SubscriptionRow,
} from "@/components/admin/subscriptions-table";
import { StatTile } from "@/components/franchise/stat-tile";
import { formatMoney, money } from "@/lib/domain/money";
import { CHANNELS, daysLeft, reachable } from "@/lib/domain/subscription-reminder";
import { readSubscriptions } from "@/lib/firebase/subscriptions-read";

export const metadata: Metadata = { title: "Subscriptions · Admin" };

/**
 * Who is paying, on what, and when it runs out.
 *
 * The platform sold subscriptions and showed operations none of them. There was
 * no page, no count and no query: the only way to answer "who is paying us" was
 * to open Firestore. A platform that cannot see its own revenue cannot chase a
 * renewal, and cannot tell somebody locked out this morning why.
 */
export default async function AdminSubscriptionsPage() {
  await connection();

  const subscriptions = await readSubscriptions();
  const now = new Date().getTime();

  const rows: SubscriptionRow[] = subscriptions
    .map((subscription) => {
      const left = subscription.lifetime ? null : daysLeft(subscription, now);

      return {
        id: `${subscription.collection}:${subscription.accountId}`,
        accountId: subscription.accountId,
        kind: subscription.kind,
        name: subscription.name,
        termLabel: subscription.term ?? "—",
        status: subscription.status,
        amountLabel:
          subscription.amountMinor !== undefined
            ? formatMoney(money(subscription.amountMinor))
            : undefined,
        // Formatted on the server so the server and client renders agree.
        renewsLabel: subscription.renewsAt ? describe(left) : "—",
        // A lifetime plan renews a century out. Sorting it as a date would put
        // it last in every list forever — not wrong, but not useful either.
        renewsAt: subscription.lifetime
          ? Number.MAX_SAFE_INTEGER
          : (subscription.renewsAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
        daysLeft: left,
        lifetime: Boolean(subscription.lifetime),
        remindersSent: subscription.remindersSent ?? [],
        reachable: reachable(subscription, [...CHANNELS]),
      };
    })
    // Soonest to lapse first: the thing that costs money if nobody looks.
    .sort((a, b) => a.renewsAt - b.renewsAt);

  const paying = rows.filter((row) => row.status === "active" || row.status === "trialing");
  const ending = rows.filter(
    (row) => !row.lifetime && row.daysLeft !== null && row.daysLeft >= 0 && row.daysLeft <= 14,
  );
  const lapsed = rows.filter((row) => !row.lifetime && row.daysLeft !== null && row.daysLeft < 0);
  const lifetime = rows.filter((row) => row.lifetime);

  return (
    <>
      <AdminPageHeader
        title="Subscriptions"
        description="Who is paying, on what, and when it runs out. Pick a plan to see who is on it. Renewal reminders go out automatically — how far ahead, and on which channels, is set in Controls."
      />

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Paying"
          value={paying.length}
          icon={BanknoteIcon}
          tone="success"
          hint="Active or trialing"
        />
        <StatTile
          label="Ending within 14 days"
          value={ending.length}
          icon={ClockIcon}
          tone="warning"
          hint="Reminders are on their way"
        />
        <StatTile
          label="Lapsed"
          value={lapsed.length}
          icon={TriangleAlertIcon}
          tone="danger"
          hint="Cannot trade until they renew"
        />
        <StatTile
          label="Lifetime"
          value={lifetime.length}
          icon={InfinityIcon}
          tone="info"
          hint="Never expire"
        />
      </div>

      <div className="flex flex-col gap-4 p-5">
        <SubscriptionsTable rows={rows} />
      </div>
    </>
  );
}

/** Coarse on purpose: a renewal is chased in days, not hours. */
function describe(left: number | null): string {
  if (left === null) return "—";
  if (left < 0) return `${Math.abs(left)} day${Math.abs(left) === 1 ? "" : "s"} ago`;
  if (left === 0) return "today";
  return `in ${left} day${left === 1 ? "" : "s"}`;
}
