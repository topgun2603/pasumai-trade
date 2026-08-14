import { PackageIcon, TruckIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { OrdersTable } from "@/components/franchise/orders-table";
import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import { formatMoney, money } from "@/lib/domain/money";
import { isOpen, orderTotal, type BuyerOrder } from "@/lib/domain/orders";
import { buyerOrders } from "@/lib/mock/orders";

export const metadata: Metadata = { title: "Orders" };

function sum(orders: BuyerOrder[]) {
  return money(orders.reduce((t, o) => t + orderTotal(o).minorUnits, 0));
}

export default async function OrdersPage() {
  await connection();

  const now = new Date();
  const orders = buyerOrders(now);

  const open = orders.filter(isOpen);
  const awaitingDispatch = orders.filter((o) => o.status === "paid");
  const inTransit = orders.filter((o) => o.status === "inTransit");
  const held = orders.filter(
    (o) => o.status !== "completed" && o.status !== "refunded" && o.paidAt,
  );

  return (
    <>
      <PageHeader
        title="Orders"
        description="One order is one district, because one district is one vehicle run — produce is collected at the farm, so a run calls at each village on it. Prices shown are those agreed when the order was placed; final amounts resolve from the grade recorded at pickup."
      />

      <div className="bg-border grid grid-cols-2 gap-px border-b lg:grid-cols-4">
        <StatTile
          label="Open orders"
          value={open.length}
          icon={PackageIcon}
          tone="default"
          hint="Not yet completed or refunded"
        />
        <StatTile
          label="Awaiting dispatch"
          value={awaitingDispatch.length}
          icon={TruckIcon}
          tone="warning"
          hint="Paid, no vehicle assigned"
        />
        <StatTile
          label="In transit"
          value={inTransit.length}
          icon={TruckIcon}
          tone="default"
          hint="On the road now"
        />
        <StatTile
          label="Money held"
          value={Math.round(sum(held).minorUnits / 100_000)}
          icon={WalletIcon}
          tone="default"
          hint={`${formatMoney(sum(held))} released on delivery`}
        />
      </div>

      <OrdersTable orders={orders} now={now.getTime()} />
    </>
  );
}
