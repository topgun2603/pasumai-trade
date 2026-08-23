import type { Metadata } from "next";
import { connection } from "next/server";

import { BankPanel } from "@/components/account/bank-panel";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";

export const metadata: Metadata = { title: "Bank details" };

export default async function BuyingBankPage() {
  await connection();
  await requireConsole([...BUYING_ROLES, "admin"]);

  return (
    <>
      <PageHeader
        title="Bank details"
        description="Where money is sent and taken from. Held by operations — anything wrong here is a phone call to change, because it decides where a payment lands."
      />
      <div className="flex max-w-2xl flex-col gap-6 p-5">
        <BankPanel details={{}} />
      </div>
    </>
  );
}
