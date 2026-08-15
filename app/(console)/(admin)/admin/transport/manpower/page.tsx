import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ManpowerTable } from "@/components/admin/manpower-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { manpowerAccounts } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Manpower · Admin" };

export default async function AdminManpowerPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Manpower"
        description="The crew that loads, grades and weighs at the farm gate. Rates are agreed here rather than at the roadside — a price settled with produce waiting and a vehicle running is a price the pressure of the moment decides."
        aside={
          <Button asChild>
            <Link href="/admin/transport/manpower/new">
              <PlusIcon className="size-4" />
              Register crew
            </Link>
          </Button>
        }
      />
      <ManpowerTable crew={manpowerAccounts(now)} now={now.getTime()} />
    </>
  );
}
