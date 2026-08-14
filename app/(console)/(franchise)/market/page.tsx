import type { Metadata } from "next";
import { connection } from "next/server";

import { MarketBrowser } from "@/components/market/market-browser";
import { pickupAreas, stockOffers } from "@/lib/mock/market";

export const metadata: Metadata = {
  title: "Market",
};

/**
 * The buyer-side catalogue.
 *
 * One buyer role for now: a bulk buyer. A contracted franchise and an
 * independent bulk buyer see exactly this page with exactly these
 * capabilities. Small buyers and downstream resale are deferred.
 */
export default async function MarketPage() {
  // Prices, availability and shelf life all move through the day, so this
  // renders per request rather than being prerendered at build time.
  await connection();

  const now = new Date();

  return (
    <MarketBrowser
      offers={stockOffers(now)}
      sources={pickupAreas()}
      now={now.getTime()}
    />
  );
}
