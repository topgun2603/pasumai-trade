import { BadgeCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BuyersTable } from "@/components/admin/buyers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { consoleIsReadOnly } from "@/lib/auth/require";
import { readBuyerAccounts } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Buyers · Admin" };

export default async function AdminBuyersPage() {
  await connection();

  // A franchise reads this roster; only operations acts on it.
  const readOnly = await consoleIsReadOnly();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Buyers"
        description="Independent bulk buyers, who register themselves and arrive here already waiting on you. Franchises are listed separately — they do everything a buyer does, and onboard farmers and dispatch vehicles besides. No credit is extended; every order is paid when placed."
        /*
          The queue, not a Register button.

          There was one, and it opened a form that wrote nothing — it waited
          half a second and said "submitted for review", so operations believed
          they had created an account that did not exist. Buyers have been able
          to register themselves the whole time, at `/signup?as=buyer`, and the
          real job on this page is checking their documents.
        */
        // Nothing for a franchise: the verification queue is the documents
        // themselves, which is the one part of this console closed to them.
        aside={
          readOnly ? undefined : (
            <Button asChild variant="outline">
              <Link href="/admin/kyc">
                <BadgeCheckIcon className="size-4" />
                Verification queue
              </Link>
            </Button>
          )
        }
      />
      <BuyersTable
        accounts={await readBuyerAccounts()}
        now={now.getTime()}
        readOnly={readOnly}
      />
    </>
  );
}
