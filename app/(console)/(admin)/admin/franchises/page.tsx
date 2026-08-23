import type { Metadata } from "next";
import { connection } from "next/server";

import { BuyersTable } from "@/components/admin/buyers-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { readFranchiseAccounts } from "@/lib/firebase/roster-read";

export const metadata: Metadata = { title: "Franchises · Admin" };

/**
 * Franchises, separately from buyers.
 *
 * The two were one list while they were thought to be one thing. Splitting the
 * collection without splitting this page would have made three real accounts
 * invisible to operations — they would have signed in and worked, and nobody
 * here could have found them.
 *
 * Same table as buyers, because the record is still the same shape. What
 * differs is what a franchise may *do* — onboard farmers, dispatch vehicles —
 * and that is enforced by the console guards, not by the document.
 */
export default async function AdminFranchisesPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Franchises"
        description="Contracted franchises. They buy produce like any buyer, and unlike a buyer they onboard farmers and dispatch vehicles in their districts."
      />
      <BuyersTable
        kind="franchises"
        accounts={await readFranchiseAccounts()}
        now={now.getTime()}
      />
    </>
  );
}
