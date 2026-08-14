import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminListingsTable } from "@/components/admin/admin-listings-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { openListings } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "Listings · Admin" };

export default async function AdminListingsPage() {
  await connection();
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Listings"
        description="Every listing on the platform. The filters are the moderation cases — created offline and unconfirmed, listed without photos, or priced against a platform average rather than a published mandi rate."
      />
      <AdminListingsTable listings={openListings(now)} now={now.getTime()} />
    </>
  );
}
