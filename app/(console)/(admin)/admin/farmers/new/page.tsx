import type { Metadata } from "next";
import { connection } from "next/server";

import { FarmerRegistrationForm } from "@/components/admin/farmer-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { canTransact } from "@/lib/domain/admin";
import { activeProduce } from "@/lib/domain/models";
import { readBuyerAccounts } from "@/lib/firebase/roster-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { DISTRICTS } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "Register farmer · Admin" };

export default async function NewFarmerPage() {
  await connection();

  // Only a verified account may onboard a farmer — a suspended franchise
  // should not be adding suppliers.
  const accounts = (await readBuyerAccounts())
    .filter((a) => canTransact(a.status))
    .map((a) => a.name);

  // Retired crops stay in the catalogue for the sake of old listings, but a
  // farmer registering today should not be able to pick one.
  const crops = activeProduce(Object.values(CATALOGUE)).map((p) => p.names.en);

  return (
    <>
      <AdminPageHeader
        title="Register a farmer"
        description="Onboarding is done on the farmer's behalf by a verified account. Bank details must be verified against the passbook in person."
      />
      <FarmerRegistrationForm
        districts={[...DISTRICTS]}
        crops={crops}
        accounts={accounts}
      />
    </>
  );
}
