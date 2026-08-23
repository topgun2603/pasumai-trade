import type { Metadata } from "next";
import { connection } from "next/server";

import { BankPanel } from "@/components/account/bank-panel";
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
        description="Where payment for a completed run is sent. Held by operations — anything wrong here is a phone call to change, because it decides where the money lands."
      />
      <div className="flex max-w-2xl flex-col gap-6 p-5">
        <BankPanel details={{}} />
      </div>
    </>
  );
}
