import "server-only";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * The villages the platform collects from, as operations maintain them.
 *
 * The coverage section had the same problem the price section had: it listed
 * `lib/mock/locations` and said "these are the villages we reach". Operations
 * have been editing districts and places in Controls all along, and the page
 * went on showing the seed — which is how the front of the site came to claim
 * twelve villages while the platform was configured for thirteen.
 *
 * Two collection reads and a join in memory. `places` holds a `districtId`
 * rather than a district name, and the name is what the card shows; a
 * denormalised name on the place would go stale the first time a district is
 * renamed.
 */

export interface CoveragePlace {
  readonly id: string;
  readonly name: string;
  readonly districtName: string;
  readonly pincode: string;
  readonly farmerCount: number;
}

export interface Coverage {
  readonly places: CoveragePlace[];
  /**
   * False when this is the seeded list rather than the platform's own.
   *
   * The page says so on the section. A list of villages a farmer might read as
   * "they come to mine" has to be the real one or be visibly marked, the same
   * way a price does.
   */
  readonly live: boolean;
}

export async function readCoverage(fallback: CoveragePlace[]): Promise<Coverage> {
  if (!hasAdminCredentials()) return { places: fallback, live: false };

  try {
    const db = adminDb();
    const [placeDocs, districtDocs] = await Promise.all([
      db.collection("places").get(),
      db.collection("districts").get(),
    ]);

    if (placeDocs.empty) return { places: fallback, live: false };

    const districtNames = new Map<string, string>();
    for (const doc of districtDocs.docs) {
      const name = doc.data().name;
      if (typeof name === "string" && name) districtNames.set(doc.id, name);
    }

    const places = placeDocs.docs
      .flatMap((doc): CoveragePlace[] => {
        const data = doc.data();
        // A retired village is not somewhere a vehicle goes. Places carry the
        // same `active` flag crops do, and for the same reason: coverage is
        // withdrawn far more often than it is deleted.
        if (data.active === false) return [];

        const name = typeof data.name === "string" ? data.name : "";
        if (!name) return [];

        return [
          {
            id: doc.id,
            name,
            districtName:
              districtNames.get(
                typeof data.districtId === "string" ? data.districtId : "",
              ) ?? "",
            pincode: typeof data.pincode === "string" ? data.pincode : "",
            farmerCount: typeof data.farmerCount === "number" ? data.farmerCount : 0,
          },
        ];
      })
      // District then village, not by distance: a public page has no visitor
      // location to measure from.
      .sort(
        (a, b) =>
          a.districtName.localeCompare(b.districtName, "en-IN") ||
          a.name.localeCompare(b.name, "en-IN"),
      );

    return places.length > 0 ? { places, live: true } : { places: fallback, live: false };
  } catch {
    return { places: fallback, live: false };
  }
}
