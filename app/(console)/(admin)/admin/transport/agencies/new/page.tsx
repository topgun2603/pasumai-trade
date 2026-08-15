import type { Metadata } from "next";
import { connection } from "next/server";

import { AgencyRegistrationForm } from "@/components/admin/agency-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Register agency · Admin" };

export default async function NewAgencyPage() {
  await connection();

  const districts = GEOGRAPHY.districts
    .filter((d) => d.active)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  return (
    <>
      <AdminPageHeader
        title="Register an agency"
        description="A labour or transport contractor. Registering the company is all operations does — the agency then signs in and enters its own workers and vehicles, which you review here."
      />
      <AgencyRegistrationForm districts={districts} />
    </>
  );
}
