import type { Metadata } from "next";
import { connection } from "next/server";

import { DispatchBoard } from "@/components/franchise/dispatch-board";
import { PageHeader } from "@/components/page-header";
import { driverAccounts, vehicles } from "@/lib/mock/admin";
import { buyerOrders } from "@/lib/mock/orders";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage() {
  await connection();

  const now = new Date();

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Licence, insurance, fitness and permit are checked before a vehicle can be assigned. An ineligible vehicle is shown with its reason rather than hidden — and a certificate that lapses after assignment grounds the load until it is reassigned."
      />

      <DispatchBoard
        orders={buyerOrders(now)}
        fleet={vehicles(now)}
        drivers={driverAccounts(now)}
        now={now.getTime()}
      />
    </>
  );
}
