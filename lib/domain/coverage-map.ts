import { haversineKm, isInIndia } from "./distance";

/**
 * Placing the coverage on a map of India.
 *
 * The section used to be a grid of village cards and nothing else, which
 * answers "which villages" and not the question somebody actually has, which is
 * *where*. A reader in Guntur cannot tell from a list of Tamil names whether
 * the platform is anywhere near them.
 *
 * Pure geometry and grouping here, so the bits worth being sure about are
 * testable without a browser or a tile server.
 */

export interface MappedPlace {
  readonly id: string;
  readonly name: string;
  readonly districtName: string;
  readonly farmerCount: number;
  readonly lat: number;
  readonly lng: number;
}

export interface OpeningState {
  readonly id: string;
  readonly name: string;
  readonly nativeName?: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * Where to put a label for a state we have not opened yet.
 *
 * A constant because the states collection carries no coordinates, and adding
 * a column to it is a migration for four rows that move never. If a state ever
 * gains `lat`/`lng` in Firestore, the reader prefers those — see
 * `lib/firebase/places-read.ts`.
 *
 * These are label anchors, not centroids: a point roughly in the middle of the
 * state's land area, chosen so the text sits inside the state rather than in
 * the sea. Nothing is measured from them.
 */
export const STATE_ANCHOR: Record<string, { lat: number; lng: number }> = {
  ap: { lat: 15.91, lng: 79.74 },
  ka: { lat: 15.32, lng: 75.71 },
  kl: { lat: 10.85, lng: 76.27 },
  tn: { lat: 11.13, lng: 78.66 },
};

/**
 * A coordinate that could be somewhere in India, rather than 0,0 or a typo.
 *
 * `isInIndia` does the box check — it is already the platform's answer to
 * "is this coordinate plausible", and a second copy of the bounding box here
 * would be a second copy to keep in step. This adds only the part that reader
 * cannot do: deciding whether there is a number there at all.
 */
export function isPlottable(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return isInIndia({ lat, lng });
}

export interface Bounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/**
 * The box that holds every pin, with room around it.
 *
 * Fitting exactly to the pins puts the outermost village hard against the edge
 * of the frame, where it reads as cut off rather than as the edge of the
 * coverage. The padding is in degrees rather than pixels so it does not depend
 * on how large the map is drawn.
 *
 * Returns null for an empty list: there is no box that holds nothing, and a
 * caller must fall back to a view of the whole country rather than to a
 * degenerate one.
 */
export function boundsOf(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  padDegrees = 0.6,
): Bounds | null {
  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return {
    west: Math.min(...lngs) - padDegrees,
    south: Math.min(...lats) - padDegrees,
    east: Math.max(...lngs) + padDegrees,
    north: Math.max(...lats) + padDegrees,
  };
}

/**
 * Villages sharing a spot, counted rather than stacked.
 *
 * Two villages twenty kilometres apart draw as one blob at country zoom, and
 * the pin underneath the top one becomes unclickable.
 *
 * Grouped by distance, not by rounding to a grid. A grid looks simpler and is
 * wrong in a way that shows: Kumbakonam and Papanasam are 12 km apart and fall
 * either side of a tenth-of-a-degree line, so they merge or do not depending on
 * where the lines happen to land rather than on how close they are.
 *
 * Greedy and O(n²), over a sorted list so the same input always gives the same
 * pins. Both are fine for a marketing overview of a dozen villages, and neither
 * would be for a clustering engine — this is not one, and the map never zooms
 * past the state.
 */
export function groupNearby(
  places: readonly MappedPlace[],
  withinKm = 30,
): Array<{ lat: number; lng: number; places: MappedPlace[] }> {
  // Sorted first: without it, which village seeds a group depends on the order
  // Firestore returned them in, and the pins move between renders.
  const ordered = [...places].sort((a, b) => a.lat - b.lat || a.lng - b.lng || a.id.localeCompare(b.id));
  const taken = new Set<string>();
  const groups: MappedPlace[][] = [];

  for (const seed of ordered) {
    if (taken.has(seed.id)) continue;
    taken.add(seed.id);

    const group = [seed];
    for (const other of ordered) {
      if (taken.has(other.id)) continue;
      if (haversineKm(seed, other) > withinKm) continue;
      taken.add(other.id);
      group.push(other);
    }
    groups.push(group);
  }

  return groups.map((group) => ({
    // The average of the group, so a pin standing for three villages sits
    // between them rather than on whichever happened to be read first.
    lat: group.reduce((sum, p) => sum + p.lat, 0) / group.length,
    lng: group.reduce((sum, p) => sum + p.lng, 0) / group.length,
    places: group,
  }));
}
