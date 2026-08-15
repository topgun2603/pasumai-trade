import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { VehiclesTable } from "@/components/admin/vehicles-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireService } from "@/lib/auth/agency";
import { vehicles } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Fleet · Agency" };

export default async function AgencyFleetPage() {
  await connection();

  const { agency } = await requireService("transport");
  const now = new Date();

  const fleet = vehicles(now).filter((v) => v.agencyId === agency.id);

  return (
    <>
      <PageHeader
        title="Fleet"
        description="Your vehicles. Insurance, fitness and permit expiry are shown as prominently as approval — a verified vehicle with lapsed insurance must not carry a load, and nothing warns you at the roadside."
        aside={
          <Button asChild>
            <Link href="/agency/fleet/new">
              <PlusIcon className="size-4" />
              Add vehicle
            </Link>
          </Button>
        }
      />
      <VehiclesTable fleet={fleet} now={now.getTime()} />
    </>
  );
}
