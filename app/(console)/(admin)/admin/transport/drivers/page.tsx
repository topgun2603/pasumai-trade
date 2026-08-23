import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DriversTable } from "@/components/admin/drivers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { consoleIsReadOnly } from "@/lib/auth/require";
import { readAgencyRecords, readDrivers } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Drivers · Admin" };

export default async function AdminDriversPage() {
  await connection();

  // A franchise reads this roster; only operations acts on it.
  const readOnly = await consoleIsReadOnly();
  const now = new Date();
  // Operations sees every agency's records, so each row says whose it is.
  const agencyNames = Object.fromEntries((await readAgencyRecords()).map((a) => [a.id, a.name]));

  return (
    <>
      <AdminPageHeader
        title="Drivers"
        description="Anyone who may move a load. A licence lapses silently, so expiry is shown as prominently as approval — a verified driver with an expired licence must not be dispatched."
        aside={
          <Button asChild>
            <Link href="/admin/transport/drivers/new">
              <PlusIcon className="size-4" />
              Register driver
            </Link>
          </Button>
        }
      />
      <DriversTable drivers={await readDrivers()} agencyNames={agencyNames} now={now.getTime()} readOnly={readOnly} />
    </>
  );
}
