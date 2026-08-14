import {
  AlertTriangleIcon,
  BoxesIcon,
  SproutIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import {
  ActivityChart,
  CropValueChart,
  DistrictChart,
  GradeMix,
  MandiChart,
} from "@/components/admin/analytics-charts";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/franchise/stat-tile";
import {
  activityOverTime,
  cropVolumes,
  districtRows,
  freshnessSplit,
  gradeSplit,
  stockValue,
} from "@/lib/domain/analytics";
import { formatMoney } from "@/lib/domain/money";
import { openListings } from "@/lib/mock/listings";
import { stockOffers } from "@/lib/mock/market";

export const metadata: Metadata = { title: "Analytics · Admin" };

export default async function AnalyticsPage() {
  await connection();

  const now = new Date();
  const t = now.getTime();
  const listings = openListings(now);
  const offers = stockOffers(now);

  const value = stockValue(offers);
  const freshness = freshnessSplit(offers, t);
  const crops = cropVolumes(offers, listings);
  const districts = districtRows(listings, offers);

  const cheaperThanMandi = crops.filter((c) => c.mandiLow > 0 && c.vsMandi < 0).length;
  const withMandi = crops.filter((c) => c.mandiLow > 0).length;

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Everything here is derived from the same records the operational screens use, so the numbers cannot drift apart from them."
      />

      <div className="bg-border grid grid-cols-2 gap-px border-b lg:grid-cols-4">
        <StatTile
          label="Stock on the shelf"
          value={Math.round(value.minorUnits / 100_000)}
          icon={BoxesIcon}
          tone="default"
          hint={`${formatMoney(value)} across ${offers.length} lines`}
        />
        <StatTile
          label="At risk within a day"
          value={freshness.endOfLife}
          icon={AlertTriangleIcon}
          tone="danger"
          hint={`${formatMoney(freshness.atRisk)} unsellable tomorrow`}
        />
        <StatTile
          label="Cheaper than the mandi"
          value={cheaperThanMandi}
          icon={TrendingUpIcon}
          tone="success"
          hint={`of ${withMandi} crops with a published reference`}
        />
        <StatTile
          label="Open listings"
          value={listings.length}
          icon={SproutIcon}
          tone="default"
          hint={`across ${districts.length} districts`}
        />
      </div>

      <div className="flex flex-col gap-5 p-6">
        <ActivityChart data={activityOverTime(listings, now)} />

        <div className="grid gap-5 xl:grid-cols-2">
          <CropValueChart data={crops} />
          <MandiChart data={crops} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <DistrictChart data={districts} />
          <GradeMix data={gradeSplit(offers)} />
        </div>
      </div>
    </>
  );
}
