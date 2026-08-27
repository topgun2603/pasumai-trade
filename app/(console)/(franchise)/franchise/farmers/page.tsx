import { PackageCheckIcon, SproutIcon, TractorIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import {
  SuppliersTable,
  type Supplier,
} from "@/components/franchise/suppliers-table";
import { canTransact } from "@/lib/domain/admin";
import { produceName } from "@/lib/domain/models";
import { readFarmerAccounts } from "@/lib/firebase/roster-read";
import { CURRENT_BUYER } from "@/lib/mock/market";
import { DISTRICTS, openListings } from "@/lib/mock/listings";

export const metadata: Metadata = { title: "Farmers" };

export default async function FarmersPage() {
  await connection();

  const now = new Date();
  const listings = openListings(now);

  // A buyer sees farmers in the areas they are allowed to source from —
  // not the whole platform. Sourcing scope is an account setting, and this is
  // one of the places it has to be honoured.
  const accounts = (await readFarmerAccounts()).filter((f) =>
    CURRENT_BUYER.districts.includes(f.district),
  );

  const suppliers: Supplier[] = accounts.map((account) => {
    const theirs = listings.filter((l) => l.farmer.name === account.name);
    return {
      // The shared table keys rows by `id`.
      id: account.id,
      account,
      crops: [...new Set(theirs.map((l) => produceName(l.produce, "en")))],
      openListings: theirs.length,
    };
  });

  const verified = accounts.filter((a) => canTransact(a.status));
  const listing = suppliers.filter((s) => s.openListings > 0);
  const completed = accounts.reduce((total, a) => total + a.completedOrders, 0);

  return (
    <>
      <PageHeader
        title="Farmers"
        description="Growers in the areas you source from. Records are read-only — farmer accounts belong to whoever onboarded them, and bank details are only ever changed in person."
      />

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Suppliers in range"
          value={accounts.length}
          icon={UsersIcon}
          tone="default"
          hint={`Across ${CURRENT_BUYER.districts.length} areas`}
        />
        <StatTile
          label="Verified"
          value={verified.length}
          icon={TractorIcon}
          tone="success"
          hint="Cleared to list produce"
        />
        <StatTile
          label="Listing now"
          value={listing.length}
          icon={SproutIcon}
          tone="default"
          hint="Have produce open today"
        />
        <StatTile
          label="Orders completed"
          value={completed}
          icon={PackageCheckIcon}
          tone="default"
          hint="Across all these suppliers"
        />
      </div>

      <SuppliersTable
        suppliers={suppliers}
        areas={[...DISTRICTS]}
        now={now.getTime()}
      />
    </>
  );
}
