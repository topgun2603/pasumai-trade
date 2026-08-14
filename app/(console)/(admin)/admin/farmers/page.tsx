import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { FarmersTable } from "@/components/admin/farmers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { farmerAccounts } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Farmers · Admin" };

export default async function AdminFarmersPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Farmers"
        description="Registered growers. Farmers never self-register — a franchise onboards them and collects bank details offline, so every record has an account answerable for it."
        aside={
          <Button asChild>
            <Link href="/admin/farmers/new">
              <PlusIcon className="size-4" />
              Register farmer
            </Link>
          </Button>
        }
      />
      <FarmersTable accounts={farmerAccounts(now)} now={now.getTime()} />
    </>
  );
}
