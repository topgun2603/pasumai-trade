import "server-only";

import { STATE_ANCHOR, isPlottable, type MappedPlace, type OpeningState } from "@/lib/domain/coverage-map";

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
  /** Absent where nobody has pinned the village yet. It then has no pin. */
  readonly lat?: number;
  readonly lng?: number;
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
  /** Only the villages that can be drawn — see `isPlottable`. */
  readonly pins: MappedPlace[];
  /**
   * States the platform is configured for but has not opened.
   *
   * `active: false` on the state document is the signal, so a state goes live
   * on the map the moment operations flip it in Controls — no second list to
   * remember.
   */
  readonly opening: OpeningState[];
}

/** The pins, from whatever coverage we ended up with. */
export function pinsFrom(places: readonly CoveragePlace[]): MappedPlace[] {
  return places.flatMap((place) =>
    isPlottable(place.lat, place.lng)
      ? [
          {
            id: place.id,
            name: place.name,
            districtName: place.districtName,
            farmerCount: place.farmerCount,
            lat: place.lat as number,
            lng: place.lng as number,
          },
        ]
      : [],
  );
}

export async function readCoverage(fallback: CoveragePlace[]): Promise<Coverage> {
  const seeded = { places: fallback, live: false, pins: pinsFrom(fallback), opening: [] };
  if (!hasAdminCredentials()) return seeded;

  try {
    const db = adminDb();
    const [placeDocs, districtDocs, stateDocs] = await Promise.all([
      db.collection("places").get(),
      db.collection("districts").get(),
      db.collection("states").get(),
    ]);

    if (placeDocs.empty) return seeded;

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
            lat: typeof data.lat === "number" ? data.lat : undefined,
            lng: typeof data.lng === "number" ? data.lng : undefined,
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

    /*
      States configured but not opened. A state document already carries
      `active`, so this needs no second list — a state appears as "opening" the
      moment operations add it and stops the moment they switch it on.

      The label anchor prefers coordinates on the document and falls back to the
      constant, so a state can be moved on the map without a deployment once
      anybody adds the field.
    */
    const opening = stateDocs.docs.flatMap((doc): OpeningState[] => {
      const data = doc.data();
      if (data.active !== false) return [];

      const name = typeof data.name === "string" ? data.name : "";
      if (!name) return [];

      const anchor =
        isPlottable(data.lat, data.lng)
          ? { lat: data.lat as number, lng: data.lng as number }
          : STATE_ANCHOR[doc.id];
      // A state nobody can place is left off rather than dropped at the
      // equator, where it would read as coverage in the Indian Ocean.
      if (!anchor) return [];

      return [
        {
          id: doc.id,
          name,
          nativeName: typeof data.nativeName === "string" ? data.nativeName : undefined,
          lat: anchor.lat,
          lng: anchor.lng,
        },
      ];
    });

    return places.length > 0
      ? { places, live: true, pins: pinsFrom(places), opening }
      : seeded;
  } catch {
    return seeded;
  }
}
