import { SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ProduceMarket } from "@/components/market/produce-market";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { lotBooks } from "@/lib/domain/lot-book";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
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

  const [listings, { threads }, { vocabulary }] = await Promise.all([
    readMarketListings(),
    readNegotiations(negotiations(clock)),
    // The opening message comes from the same fixed list the bargaining screen
    // uses, so this page needs it too.
    readBargainVocabulary(),
  ]);

  // Which lots this buyer is already talking about, so the row offers to
  // continue rather than to open a second thread the domain would refuse.
  const openThreads: Record<string, string> = {};
  for (const thread of threads) {
    if (thread.buyerId !== session.claims.accountId || thread.status !== "open") continue;
    openThreads[thread.listingId] = thread.id;
  }

  /*
    How much of each lot is gone and how much is being chased. Built from every
    bargain on the listing, not just this buyer's, because "two other people
    want this" is the thing a buyer most needs and cannot see.

    Only the totals cross to the browser. `LotBook` carries no rates, so a
    competitor's price never leaves the server — depth is a market fact, a
    rival's number is theirs.
  */
  const books = lotBooks({
    // The lot as posted, not `listing.grades` — that is already the remainder,
    // and the book subtracts the sales itself. Passing the remainder takes them
    // off twice and draws a market smaller than it is.
    listings: listings.map((l) => ({ id: l.id, grades: l.posted })),
    threads,
    viewerBuyerId: session.claims.accountId,
  });

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
          <ProduceMarket
            listings={listings}
            openThreads={openThreads}
            books={books}
            vocabulary={vocabulary}
          />
        )}
      </div>
    </>
  );
}
