import type { Metadata } from "next";
import { connection } from "next/server";

import { DriverRegistrationForm } from "@/components/admin/driver-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { vehicles } from "@/lib/mock/admin";
import { DISTRICTS } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "Register driver · Admin" };

export default async function NewDriverPage() {
  await connection();

  // Only vehicles nobody is already driving can be offered here.
  const unassigned = vehicles(new Date())
    .filter((v) => !v.assignedDriver)
    .map((v) => v.registration);

  return (
    <>
      <AdminPageHeader
        title="Register a driver"
        description="Anyone who may move a load. The licence class must cover goods vehicles, and expiry is checked before every dispatch."
      />
      <DriverRegistrationForm districts={[...DISTRICTS]} vehicles={unassigned} />
    </>
  );
}
