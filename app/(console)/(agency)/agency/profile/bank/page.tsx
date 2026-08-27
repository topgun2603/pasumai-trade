import type { Metadata } from "next";
import { connection } from "next/server";

import { BankSection } from "@/components/account/bank-section";
import { PageHeader } from "@/components/page-header";
import { requireAgency } from "@/lib/auth/agency";

export const metadata: Metadata = { title: "Bank details · Agency" };

export default async function AgencyBankPage() {
  await connection();
  await requireAgency();

  return (
    <>
      <PageHeader
        title="Bank details"
        description="Where payment for a completed run is sent. Add an account, verify it with a one rupee check, and choose which one is paid."
      />
      <div className="flex max-w-2xl flex-col gap-6 p-5">
        <BankSection />
      </div>
    </>
  );
}
