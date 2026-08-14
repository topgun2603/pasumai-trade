import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { VehicleRegistrationForm } from "@/components/admin/vehicle-form";
import { canTransact } from "@/lib/domain/admin";
import { buyerAccounts, driverAccounts } from "@/lib/mock/admin";
import { DISTRICTS } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "Register vehicle · Admin" };

export default async function NewVehiclePage() {
  await connection();
  const now = new Date();

  const drivers = driverAccounts(now);

  // A vehicle is owned either by a verified buying account or by a driver
  // running their own vehicle.
  const owners = [
    ...buyerAccounts(now)
      .filter((a) => canTransact(a.status))
      .map((a) => a.name),
    ...drivers.filter((d) => canTransact(d.status)).map((d) => d.name),
  ];

  const unassigned = drivers
    .filter((d) => !d.assignedVehicle)
    .map((d) => d.name);

  return (
    <>
      <AdminPageHeader
        title="Register a vehicle"
        description="Registration, RC, insurance, fitness and permit. Compliance is the worst of the four — the vehicle is only dispatchable while every one of them is in date."
      />
      <VehicleRegistrationForm
        districts={[...DISTRICTS]}
        owners={owners}
        drivers={unassigned}
      />
    </>
  );
}
