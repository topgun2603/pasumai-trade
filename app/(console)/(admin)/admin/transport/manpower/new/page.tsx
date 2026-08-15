import type { Metadata } from "next";
import { connection } from "next/server";

import { ManpowerRegistrationForm } from "@/components/admin/manpower-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Register crew · Admin" };

export default async function NewManpowerPage() {
  await connection();

  // Only active locations. Registering a crew member to a village nobody
  // collects from produces a record dispatch can never use.
  const districts = GEOGRAPHY.districts
    .filter((d) => d.active)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  const places = GEOGRAPHY.places
    .filter((p) => p.active)
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  return (
    <>
      <AdminPageHeader
        title="Register crew"
        description="Loading, grading and weighing hands. Bank details are required — a crew member who cannot be paid electronically is a crew member paid in cash at the roadside."
      />
      <ManpowerRegistrationForm districts={districts} places={places} />
    </>
  );
}
