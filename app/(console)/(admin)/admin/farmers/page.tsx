import { BadgeCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { FarmersTable } from "@/components/admin/farmers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { readFarmerAccounts } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Farmers · Admin" };

export default async function AdminFarmersPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Farmers"
        description="Registered growers. Farmers never self-register — a franchise onboards them and collects bank details offline, so every record has an account answerable for it."
        /*
          The queue, not a Register button — the button opened a form that
          wrote nothing. Farmers register themselves at `/signup?as=farmer`,
          and the work on this page is checking what they sent.

          The in-person path a franchise is meant to have does not exist yet:
          `/franchise/farmers` lists growers but cannot add one. Worth building
          — a grower with no smartphone is exactly who a franchise signs up —
          but it is a franchise screen, not this one.
        */
        aside={
          <Button asChild variant="outline">
            <Link href="/admin/kyc">
              <BadgeCheckIcon className="size-4" />
              Verification queue
            </Link>
          </Button>
        }
      />
      <FarmersTable accounts={await readFarmerAccounts()} now={now.getTime()} />
    </>
  );
}
