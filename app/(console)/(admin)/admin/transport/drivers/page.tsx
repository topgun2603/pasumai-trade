import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DriversTable } from "@/components/admin/drivers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { driverAccounts } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Drivers · Admin" };

export default async function AdminDriversPage() {
  await connection();
  const now = new Date();

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
      <DriversTable drivers={driverAccounts(now)} now={now.getTime()} />
    </>
  );
}
