import type { Metadata } from "next";
import { connection } from "next/server";

import { WorkerRegistrationForm } from "@/components/agency/worker-form";
import { PageHeader } from "@/components/page-header";
import { requireService } from "@/lib/auth/agency";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Add worker · Agency" };

export default async function NewWorkerPage() {
  await connection();

  const { agency } = await requireService("manpower");

  // Only the districts this agency is contracted to serve. Registering a
  // worker somewhere the agency does not operate produces a record dispatch
  // can never use.
  const districts = GEOGRAPHY.districts
    .filter((d) => d.active && agency.districts.includes(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  const districtIds = new Set(
    GEOGRAPHY.districts.filter((d) => districts.includes(d.name)).map((d) => d.id),
  );

  const places = GEOGRAPHY.places
    .filter((p) => p.active && districtIds.has(p.districtId))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  return (
    <>
      <PageHeader
        title="Add a worker"
        description="Your crew member. Bank details are required — anyone who cannot be paid electronically is someone paid in cash at the roadside, which is the arrangement this platform exists to replace."
      />
      <WorkerRegistrationForm districts={districts} places={places} />
    </>
  );
}
