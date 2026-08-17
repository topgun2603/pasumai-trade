import type { Metadata } from "next";
import { connection } from "next/server";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { AgenciesTable } from "@/components/admin/agencies-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { driverAccounts, vehicles, workers } from "@/lib/mock/admin";
import { readAgencies } from "@/lib/firebase/agency-read";

export const metadata: Metadata = { title: "Agencies · Admin" };

export default async function AdminAgenciesPage() {
  await connection();
  const now = new Date();

  const crew = workers(now);
  const fleet = vehicles(now);
  const drivers = driverAccounts(now);

  // From Firestore, where registering one writes it — this list read the
  // samples, so an agency operations had just created was missing from the
  // page they created it on.
  const registered = await readAgencies(now);

  const rows = registered.map((agency) => ({
    ...agency,
    workerCount: crew.filter((w) => w.agencyId === agency.id).length,
    vehicleCount: fleet.filter((v) => v.agencyId === agency.id).length,
    driverCount: drivers.filter((d) => d.agencyId === agency.id).length,
  }));

  return (
    <>
      <AdminPageHeader
        title="Agencies"
        description="The labour and transport contractors the platform works with. They register their own workers and vehicles under their own login; operations verifies them. An agency's own lapsed document grounds everything it registered — the worker is never the problem in that case."
        aside={
          <Button asChild>
            <Link href="/admin/transport/agencies/new">
              <PlusIcon className="size-4" />
              Register agency
            </Link>
          </Button>
        }
      />
      <AgenciesTable rows={rows} now={now.getTime()} />
    </>
  );
}
