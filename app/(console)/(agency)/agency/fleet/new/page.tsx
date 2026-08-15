import type { Metadata } from "next";
import { connection } from "next/server";

import { VehicleRegistrationForm } from "@/components/agency/vehicle-form";
import { PageHeader } from "@/components/page-header";
import { requireService } from "@/lib/auth/agency";
import { driverAccounts } from "@/lib/mock/admin";
import { GEOGRAPHY } from "@/lib/mock/locations";

export const metadata: Metadata = { title: "Add vehicle · Agency" };

export default async function NewAgencyVehiclePage() {
  await connection();

  const { agency } = await requireService("transport");
  const now = new Date();

  const districts = GEOGRAPHY.districts
    .filter((d) => d.active && agency.districts.includes(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  const drivers = driverAccounts(now)
    .filter((d) => d.agencyId === agency.id)
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "en-IN"));

  return (
    <>
      <PageHeader
        title="Add a vehicle"
        description="Your vehicle. Insurance, fitness and permit dates are what ground a truck at the roadside, so they are collected here and watched from the day it is registered."
      />
      {/* The owner on the RC is not always the agency — an owner-driver
          contracting to you is common — so it stays a free field rather than
          being assumed. */}
      <VehicleRegistrationForm
        districts={districts}
        owners={[agency.name]}
        drivers={drivers}
      />
    </>
  );
}
