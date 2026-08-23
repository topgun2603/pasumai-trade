import {
  BadgeCheckIcon,
  HandshakeIcon,
  PackageIcon,
  StoreIcon,
  TruckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { formatMoney, money } from "@/lib/domain/money";
import { isOpen, orderTotal } from "@/lib/domain/orders";
import {
  daysRemaining,
  effectiveStatus,
  SUBSCRIPTION_LABELS,
} from "@/lib/domain/subscription";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readAccountState } from "@/lib/firebase/subscription-read";
import { buyerOrders } from "@/lib/mock/orders";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Overview" };

/**
 * What a buyer should do now.
 *
 * Bug 15 asked for Overview to be each role's summary — account standing, the
 * figures that matter, what is waiting on them and what is in flight. The
 * buying console had no such page at all; sign-in dropped people straight into
 * the marketplace, which answers "what is for sale" and never "where do I
 * stand".
 *
 * Everything here is a link. A summary that reports a number and gives no way
 * to act on it is a dashboard, and a dashboard is what somebody looks at
 * instead of working.
 */
export default async function BuyingOverviewPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const now = new Date();

  const [state, { threads }] = await Promise.all([
    readAccountState(session.claims.role, session.claims.accountId),
    readNegotiations(negotiations(now.getTime())),
  ]);

  const orders = buyerOrders(now);
  const open = orders.filter(isOpen);
  const inTransit = orders.filter((o) => o.status === "inTransit");

  // Bargains where the other side has spoken last, so the ball is here.
  const yourMove = threads.filter((thread) => {
    if (thread.status !== "open") return false;
    const last = thread.messages.at(-1);
    return last !== undefined && last.author === "farmer";
  });

  const committed = money(open.reduce((total, o) => total + orderTotal(o).minorUnits, 0));
  const standing = effectiveStatus(state.subscription, now);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Where you stand today, and what is waiting on you."
      />

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Waiting on you"
          value={yourMove.length}
          hint="Bargains where the farmer has replied"
          icon={HandshakeIcon}
        />
        <StatTile
          label="Open orders"
          value={open.length}
          hint={`${formatMoney(committed)} committed`}
          icon={PackageIcon}
        />
        <StatTile
          label="On the road"
          value={inTransit.length}
          hint="Collected and travelling"
          icon={TruckIcon}
        />
        {/*
          Days, not a word. The tile dims itself at zero, which is exactly the
          right treatment for a plan that has run out.
        */}
        <StatTile
          label="Days of plan left"
          value={
            state.subscription && standing === "active"
              ? Math.max(0, daysRemaining(state.subscription, now))
              : 0
          }
          hint={
            standing === "none"
              ? "No plan yet"
              : standing === "active"
                ? SUBSCRIPTION_LABELS[standing]
                : SUBSCRIPTION_LABELS[standing]
          }
          icon={BadgeCheckIcon}
        />
      </div>

      <div className="flex flex-col gap-6 p-5">
        {/*
          The one thing worth interrupting for. Somebody who cannot trade needs
          to know that here rather than discovering it at the moment they try.
        */}
        {standing !== "active" && standing !== "trialing" ? (
          <div className="border-warning/40 bg-warning-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <span className="text-warning text-sm font-medium">
              {standing === "none"
                ? "Browsing is free. Bargaining and ordering need a plan."
                : "Your plan is not active, so bargaining and ordering are closed."}
            </span>
            <Button asChild size="sm">
              <Link href="/account/subscription">See plans</Link>
            </Button>
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Pick up where you left off</h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/listings">
                <StoreIcon className="size-4" />
                Marketplace
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/bargains">
                <HandshakeIcon className="size-4" />
                {yourMove.length > 0
                  ? `${yourMove.length} bargain${yourMove.length === 1 ? "" : "s"} waiting`
                  : "Bargains"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders">
                <PackageIcon className="size-4" />
                Orders
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/account">
                <BadgeCheckIcon className="size-4" />
                Account
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
