import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { VehiclesTable } from "@/components/admin/vehicles-table";
import { Button } from "@/components/ui/button";
import { vehicles } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Vehicles · Admin" };

export default async function AdminVehiclesPage() {
  await connection();
  const now = new Date();

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
      <VehiclesTable fleet={vehicles(now)} now={now.getTime()} />
    </>
  );
}
