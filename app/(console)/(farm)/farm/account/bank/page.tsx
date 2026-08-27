import type { Metadata } from "next";
import { connection } from "next/server";

import { BankSection } from "@/components/account/bank-section";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";

export const metadata: Metadata = { title: "Bank details · Farmer" };

/**
 * Where a farmer's money goes, and who decides it.
 *
 * This used to be a read-only panel showing four digits that operations had
 * typed in, with a line explaining that changing them was a phone call. It is
 * the farmer's own page now: they add the account, prove it with a one rupee
 * check, and choose which one is paid.
 *
 * The account number is still only ever shown as its last four digits — right
 * for a screen read in a field with other people around, and enough to
 * recognise your own.
 */
export default async function FarmBankPage() {
  await connection();
  await requireFarmer();

  return (
    <>
      <PageHeader
        title="Bank details"
        description="Where your money is sent after a sale. Add the account, verify it with a one rupee check, and choose which one is paid."
      />
      <div className="flex max-w-2xl flex-col gap-6 p-5">
        <BankSection />
      </div>
    </>
  );
}
