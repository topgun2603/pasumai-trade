import type { Metadata } from "next";
import { connection } from "next/server";

import { DriversTable } from "@/components/admin/drivers-table";
import { PageHeader } from "@/components/page-header";
import { requireService } from "@/lib/auth/agency";
import { driverAccounts } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Drivers · Agency" };

export default async function AgencyDriversPage() {
  await connection();

  const { agency } = await requireService("transport");
  const now = new Date();

  const drivers = driverAccounts(now).filter((d) => d.agencyId === agency.id);

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Your drivers. A licence lapses silently, so expiry is shown beside verification — a verified driver with an expired licence cannot be dispatched."
      />
      <DriversTable drivers={drivers} now={now.getTime()} />
    </>
  );
}
