import type { Metadata } from "next";
import { connection } from "next/server";

import { ManpowerTable } from "@/components/admin/manpower-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { agencies, workers } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Manpower · Admin" };

export default async function AdminManpowerPage() {
  await connection();
  const now = new Date();
  // Operations sees every agency's records, so each row says whose it is.
  const agencyNames = Object.fromEntries(agencies(now).map((a) => [a.id, a.name]));

  return (
    <>
      <AdminPageHeader
        title="Manpower"
        description="Every worker across every agency. Agencies enter their own crew under their own login; operations verifies them. Rates are agreed on the record rather than at the roadside, where a vehicle running decides the price."
      />
      <ManpowerTable crew={workers(now)} agencyNames={agencyNames} now={now.getTime()} />
    </>
  );
}
