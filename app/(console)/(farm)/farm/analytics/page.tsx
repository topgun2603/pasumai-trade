import type { Metadata } from "next";
import { connection } from "next/server";

import { SalesAnalytics } from "@/components/farm/sales-analytics";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";
import { salesFrom } from "@/lib/domain/farm-analytics";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Analytics · Farmer" };

/**
 * What the farmer's crop is actually worth, from their own settled bargains.
 *
 * The whole argument for this platform is that a farmer negotiating from
 * evidence gets a better price than one anchored by the first number a buyer
 * says. This page is that evidence, and it is deliberately their own history
 * rather than a market index — an index is a number somebody else set, which
 * is the thing being replaced.
 */
export default async function FarmAnalyticsPage() {
  await connection();

  const { farmer } = await requireFarmer();
  const clock = new Date().getTime();

  const { threads } = await readNegotiations(negotiations(clock));
  const sales = salesFrom(threads.filter((t) => t.farmerId === farmer.id));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Every price you have settled, by crop and grade. Yours alone — not a published rate."
      />
      <div className="flex flex-col gap-6 p-5">
        <SalesAnalytics sales={sales} />
      </div>
    </>
  );
}
