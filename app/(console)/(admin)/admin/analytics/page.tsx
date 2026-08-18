import { ClockIcon, HandshakeIcon, SproutIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AccountsPanel,
  ActivityByDay,
  SettledRates,
  SupplyByCrop,
  SupplyByDistrict,
} from "@/components/admin/platform-charts";
import { StatTile } from "@/components/franchise/stat-tile";
import {
  accountMix,
  activityByDay,
  hoursToSettle,
  outcomes,
  real,
  settledRates,
  supplyByCrop,
  supplyByDistrict,
} from "@/lib/domain/platform-analytics";
import { readAnalytics } from "@/lib/firebase/analytics-read";

export const metadata: Metadata = { title: "Analytics · Admin" };

/**
 * What the platform can honestly say about itself.
 *
 * This page used to be built entirely from `lib/mock` — seeded stock and
 * seeded listings — under a header claiming the numbers were "derived from the
 * same records the operational screens use". They were derived from no record
 * at all. One tile compared prices against "the mandi", for which there is no
 * feed and never has been: the reference it charted against did not exist.
 *
 * Everything here now comes from collections somebody actually wrote to, and
 * anything the platform cannot know is absent rather than estimated. That is
 * why there is no inventory valuation — nothing here holds stock — and no
 * market comparison.
 *
 * Seeded listings are excluded. A demo row is something the platform wrote
 * about itself, which is the one thing that cannot be evidence about it.
 */
export default async function AnalyticsPage() {
  await connection();

  const { listings, bargains, accounts, live } = await readAnalytics();
  const now = new Date().getTime();

  const traded = real(listings);
  const crops = supplyByCrop(traded);
  const districts = supplyByDistrict(traded);
  const result = outcomes(bargains);
  const settled = settledRates(bargains);
  const hours = hoursToSettle(bargains);

  const seeded = listings.length - traded.length;

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Everything here is counted from the records the operational screens write. Nothing is modelled, and what the platform cannot know is left out rather than estimated."
      />

      {live ? null : (
        <p className="border-warning/40 bg-warning-soft text-warning border-b px-6 py-3 text-sm">
          Nothing could be read from the database, so every figure below is zero. That is a
          failure to read, not a quiet platform.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Listings posted"
          value={traded.length}
          icon={SproutIcon}
          tone="success"
          hint={
            seeded > 0
              ? `${districts.length} districts · ${seeded} seeded row${seeded === 1 ? "" : "s"} excluded`
              : `across ${districts.length} districts`
          }
        />
        <StatTile
          label="Bargains agreed"
          value={result.agreed}
          icon={HandshakeIcon}
          tone="success"
          hint={
            result.agreedShare === null
              ? "nothing has finished yet"
              : `${result.agreedShare}% of finished bargains`
          }
        />
        <StatTile
          label="Bargains open"
          value={result.open}
          icon={ClockIcon}
          tone="warning"
          hint={
            // Null rather than zero when nothing has settled. Zero hours is a
            // real answer meaning "instantly".
            hours === null ? "none settled yet" : `typically ${hours}h to settle`
          }
        />
        <StatTile
          label="Accounts"
          value={accounts.length}
          icon={UsersIcon}
          tone="info"
          hint={`${accounts.filter((a) => a.status === "verified").length} verified`}
        />
      </div>

      <div className="flex flex-col gap-5 p-6">
        <ActivityByDay data={activityByDay(traded, bargains, now)} />

        <div className="grid gap-5 xl:grid-cols-2">
          <SupplyByCrop data={crops} />
          <SettledRates data={settled} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SupplyByDistrict data={districts} />
          <AccountsPanel data={accountMix(accounts)} />
        </div>
      </div>
    </>
  );
}
