import type { Metadata } from "next";
import { connection } from "next/server";

import { KycOnboarding } from "@/components/kyc/onboarding";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { readChecks } from "@/lib/firebase/kyc-read";
import { onboardingView } from "@/lib/kyc/view";

export const metadata: Metadata = { title: "Verification · Farmer" };

export default async function FarmVerificationPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const checks = await readChecks("farmer", farmer.id);

  return (
    <>
      <PageHeader
        title="Verification"
        description="Who you are and where you get paid. Done once."
      />
      <div className="flex flex-col gap-6 p-5">
        <KycOnboarding view={onboardingView(checks, "farmer")} roleLabel="Farmer" />
      </div>
    </>
  );
}
