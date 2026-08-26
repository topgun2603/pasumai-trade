import "server-only";

import type { Reach } from "@/lib/domain/reach";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * How many states and districts the platform actually covers.
 *
 * Two aggregation queries rather than two collection reads. `count()` is
 * billed as a single document read whatever the size of the collection and
 * returns no data, which matters here for two reasons: this runs on the public
 * landing page, and none of these documents contain anything the page is
 * entitled to show.
 *
 * Coverage is counted from the states and districts operations maintain in
 * Controls, not from where farmers happen to have signed up. It is a statement
 * about where a vehicle will go, and it is true before the first farmer in a
 * district joins.
 *
 * A failure returns the caller's fallback rather than zeroes. A landing page
 * that reports no districts because a query timed out is worse than one showing
 * the figures it shipped with.
 */
export async function readReach(fallback: Reach): Promise<{ reach: Reach; live: boolean }> {
  if (!hasAdminCredentials()) return { reach: fallback, live: false };

  try {
    const db = adminDb();

    const [states, districts] = await Promise.all([
      db.collection("states").count().get(),
      db.collection("districts").count().get(),
    ]);

    return {
      reach: { states: states.data().count, districts: districts.data().count },
      live: true,
    };
  } catch {
    return { reach: fallback, live: false };
  }
}
