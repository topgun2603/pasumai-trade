import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { VehiclesTable } from "@/components/admin/vehicles-table";
import { Button } from "@/components/ui/button";
import { consoleIsReadOnly } from "@/lib/auth/require";
import { readAgencyRecords, readVehicles } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Vehicles · Admin" };

export default async function AdminVehiclesPage() {
  await connection();

  // A franchise reads this roster; only operations acts on it.
  const readOnly = await consoleIsReadOnly();
  const now = new Date();
  // Operations sees every agency's records, so each row says whose it is.
  const agencyNames = Object.fromEntries((await readAgencyRecords()).map((a) => [a.id, a.name]));

  return (
    <>
      <AdminPageHeader
        title="Vehicles"
        description="Registered fleet across all owners. Compliance is the worst of RC, insurance, fitness and permit — valid insurance does not help when the fitness certificate lapsed last week."
        aside={
          <Button asChild>
            <Link href="/admin/transport/vehicles/new">
              <PlusIcon className="size-4" />
              Register vehicle
            </Link>
          </Button>
        }
      />
      <VehiclesTable fleet={await readVehicles()} agencyNames={agencyNames} now={now.getTime()} readOnly={readOnly} />
    </>
  );
}
