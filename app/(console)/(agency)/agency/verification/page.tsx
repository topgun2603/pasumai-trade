import type { Metadata } from "next";
import { connection } from "next/server";

import { KycOnboarding } from "@/components/kyc/onboarding";
import { PageHeader } from "@/components/page-header";
import { requireAgency } from "@/lib/auth/agency";
import { verifySession } from "@/lib/auth/session";
import { readChecks } from "@/lib/firebase/kyc-read";
import { onboardingView } from "@/lib/kyc/view";

export const metadata: Metadata = { title: "Verification · Agency" };

export default async function AgencyVerificationPage() {
  await connection();

  const { agency } = await requireAgency();
  const session = await verifySession();
  const role = session!.claims.role;
  const checks = await readChecks(role, agency.id);

  return (
    <>
      <PageHeader
        title="Verification"
        description="What the platform needs before your agency can take work."
      />
      <div className="flex flex-col gap-6 p-5">
        <KycOnboarding
          view={onboardingView(checks, role)}
          roleLabel={role === "transport" ? "Transport" : "Manpower"}
        />
      </div>
    </>
  );
}
