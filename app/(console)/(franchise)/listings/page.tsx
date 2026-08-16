import { SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ProduceMarket } from "@/components/market/produce-market";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { readMarketListings } from "@/lib/firebase/listings-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { negotiations } from "@/lib/mock/negotiations";

export const metadata: Metadata = { title: "Listings" };

/**
 * Produce on offer, from the farmers who posted it.
 *
 * This page read the mock catalogue and quoted a mandi reference beside every
 * row. Both are gone: the rows are real listings out of Firestore, and the
 * only price shown is what the farmer is asking. Prices here come from the two
 * people in the trade, which is the entire premise.
 */
export default async function ListingsPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const clock = new Date().getTime();

  const [listings, { threads }] = await Promise.all([
    readMarketListings(),
    readNegotiations(negotiations(clock)),
  ]);

  // Which lots this buyer is already talking about, so the row offers to
  // continue rather than to open a second thread the domain would refuse.
  const openThreads: Record<string, string> = {};
  for (const thread of threads) {
    if (thread.buyerId !== session.claims.accountId || thread.status !== "open") continue;
    openThreads[thread.listingId] = thread.id;
  }

  return (
    <>
      <PageHeader
        title="Listings"
        description="Produce posted by farmers across the districts you cover. Bargain on the grades you want — you do not have to take the whole lot."
        aside={
          <p className="text-faint text-xs">
            {listings.length} lot{listings.length === 1 ? "" : "s"} on offer
          </p>
        }
      />

      <div className="flex flex-col gap-4 p-5">
        {listings.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
            <SproutIcon className="size-7" />
            <p className="max-w-sm text-sm">
              Nothing is listed right now. Farmers post as lots come ready, so this fills up
              through the morning.
            </p>
          </div>
        ) : (
          <ProduceMarket listings={listings} openThreads={openThreads} />
        )}
      </div>
    </>
  );
}
