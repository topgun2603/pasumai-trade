import "server-only";

import type { Reach } from "@/lib/domain/reach";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * How many villages, districts and farmers the platform actually has.
 *
 * Three aggregation queries rather than three collection reads. `count()` is
 * billed as a single document read whatever the size of the collection and
 * returns no data, which matters here for two reasons: this runs on the public
 * landing page, and none of these documents contain anything the page is
 * entitled to show.
 *
 * Coverage is counted from the districts and places the platform is configured
 * for — the ones operations maintain in Controls — not from where farmers
 * happen to have signed up. "Villages covered" is a statement about where a
 * vehicle will go, and it is true before the first farmer in a village joins.
 *
 * A failure returns the caller's fallback rather than zeroes. A landing page
 * that reports no districts because a query timed out is worse than one showing
 * the figures it shipped with.
 */
export async function readReach(fallback: Reach): Promise<{ reach: Reach; live: boolean }> {
  if (!hasAdminCredentials()) return { reach: fallback, live: false };

  try {
    const db = adminDb();

    const [places, districts, farmers] = await Promise.all([
      db.collection("places").count().get(),
      db.collection("districts").count().get(),
      db.collection("farmers").count().get(),
    ]);

    return {
      reach: {
        villages: places.data().count,
        districts: districts.data().count,
        farmers: farmers.data().count,
      },
      live: true,
    };
  } catch {
    return { reach: fallback, live: false };
  }
}
