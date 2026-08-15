import { AlarmClockIcon, CircleSlashIcon, GavelIcon, TimerIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ListingsTable } from "@/components/franchise/listings-table";
import { StatTile } from "@/components/franchise/stat-tile";
import { PageHeader } from "@/components/page-header";
import { hasExpiredAt, remainingFrom } from "@/lib/domain/models";
import { DISTRICTS, openListings } from "@/lib/mock/listings";

export const metadata: Metadata = {
  title: "Listings",
};

const HOUR = 3_600_000;

export default async function ListingsPage() {
  // This page is a live queue, so it must render per request. `new Date()`
  // alone does not opt out of prerendering — without this the build bakes a
  // timestamp in and every "42m ago" freezes at build time.
  await connection();

  // Read the clock once, here, and pass it down. Every relative time on the
  // page is derived from this single value so the server render and the
  // hydrated client render agree.
  const now = new Date();
  const listings = openListings(now);

  const awaitingQuote = listings.filter((l) => l.status === "awaitingOffer");
  const offered = listings.filter((l) => l.status === "offered" && l.offer);
  const live = offered.filter((l) => !hasExpiredAt(l.offer!, now));
  const expiring = live.filter((l) => remainingFrom(l.offer!, now) < HOUR);
  const expired = offered.filter((l) => hasExpiredAt(l.offer!, now));

  return (
    <>
      <PageHeader
        title="Listings"
        description="Open produce across your districts. Quote the grades you want — grading happens at pickup, and the price resolves from the band you priced."
        aside={
          <p className="text-faint text-xs">
            {listings.length} open · {DISTRICTS.length} districts
          </p>
        }
      />

      <div className="grid grid-cols-2 gap-px border-b bg-border lg:grid-cols-4">
        <StatTile
          label="Awaiting your quote"
          value={awaitingQuote.length}
          icon={GavelIcon}
          tone="default"
          hint="No offer yet from any franchise"
        />
        <StatTile
          label="Live offers"
          value={live.length}
          icon={TimerIcon}
          tone="success"
          hint="Quoted, farmer has not responded"
        />
        <StatTile
          label="Expiring within an hour"
          value={expiring.length}
          icon={AlarmClockIcon}
          tone="warning"
          hint="Countdown is visible to the farmer"
        />
        <StatTile
          label="Expired, needs requote"
          value={expired.length}
          icon={CircleSlashIcon}
          tone="danger"
          hint="Offer lapsed before the farmer answered"
        />
      </div>

      <ListingsTable
        listings={listings}
        districts={[...DISTRICTS]}
        now={now.getTime()}
      />
    </>
  );
}
