import type { Metadata } from "next";
import { connection } from "next/server";

import { DriverRegistrationForm } from "@/components/agency/driver-form";
import { PageHeader } from "@/components/page-header";
import { requireService } from "@/lib/auth/agency";
import { vehicles } from "@/lib/mock/admin";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Add driver · Agency" };

export default async function NewAgencyDriverPage() {
  await connection();

  const { agency } = await requireService("transport");
  const now = new Date();

  const districts = GEOGRAPHY.districts
    .filter((d) => d.active && agency.districts.includes(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  // Only this agency's own vehicles can be assigned. Offering someone else's
  // fleet in the dropdown would be both wrong and a small information leak.
  const fleet = vehicles(now)
    .filter((v) => v.agencyId === agency.id)
    .map((v) => v.registration)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  return (
    <>
      <PageHeader
        title="Add a driver"
        description="Your driver. Both sides of the licence are needed — the class endorsements and validity are printed on the reverse, and those are what decide whether a load can be carried."
      />
      <DriverRegistrationForm districts={districts} vehicles={fleet} />
    </>
  );
}
