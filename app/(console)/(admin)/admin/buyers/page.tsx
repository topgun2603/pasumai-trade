import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BuyersTable } from "@/components/admin/buyers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { readBuyerAccounts } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Buyers · Admin" };

export default async function AdminBuyersPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Buyers"
        description="Contracted franchises and independent bulk buyers. Both have the same capabilities — the type is a commercial label, not a permission. No credit is extended; every order is paid when placed."
        aside={
          <Button asChild>
            <Link href="/admin/buyers/new">
              <PlusIcon className="size-4" />
              Register buyer
            </Link>
          </Button>
        }
      />
      <BuyersTable accounts={await readBuyerAccounts()} now={now.getTime()} />
    </>
  );
}
