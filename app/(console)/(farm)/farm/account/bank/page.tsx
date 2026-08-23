import type { Metadata } from "next";
import { connection } from "next/server";

import { BankPanel } from "@/components/account/bank-panel";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";

export const metadata: Metadata = { title: "Bank details · Farmer" };

/**
 * Where a farmer's money goes.
 *
 * Only the tail of the account number is stored on the farmer record, so only
 * the tail can be shown — which is the right amount for a screen read in a
 * field with other people around, and happens to be all anybody needs to
 * recognise their own account.
 */
export default async function FarmBankPage() {
  await connection();
  const { farmer } = await requireFarmer();

  return (
    <>
      <PageHeader
        title="Bank details"
        description="Where your money is sent after a sale. Operations record this when they verify you — anything wrong here is a phone call, because it decides where a payment lands."
      />
      <div className="flex max-w-2xl flex-col gap-6 p-5">
        <BankPanel
          details={
            farmer.bankAccountTail
              ? { accountNumber: `••••••••${farmer.bankAccountTail}` }
              : {}
          }
        />
      </div>
    </>
  );
}
