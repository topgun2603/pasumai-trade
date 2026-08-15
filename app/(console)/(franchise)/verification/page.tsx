import type { Metadata } from "next";
import { connection } from "next/server";

import { KycOnboarding } from "@/components/kyc/onboarding";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { readChecks } from "@/lib/firebase/kyc-read";
import { onboardingView } from "@/lib/kyc/view";

export const metadata: Metadata = { title: "Verification · Pasumai Trade" };

export default async function BuyerVerificationPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const role = session.claims.role === "admin" ? "buyer" : session.claims.role;
  const checks = await readChecks(role, session.claims.accountId);

  return (
    <>
      <PageHeader
        title="Verification"
        description="What the platform needs before you can order."
      />
      <div className="flex flex-col gap-6 p-5">
        <KycOnboarding
          view={onboardingView(checks, role)}
          roleLabel={role === "franchise" ? "Franchise" : "Buyer"}
        />
      </div>
    </>
  );
}
