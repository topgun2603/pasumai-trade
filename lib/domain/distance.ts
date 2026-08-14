/**
 * Distance between two points on the platform.
 *
 * This module exists because the thing it replaces could not work. A village
 * used to carry a stored `distanceKm` measured from the operating base — but
 * distance is not a property of a village. It is a property of a *pair*: the
 * farm the produce is at, and the buyer it is going to. With many buyers and
 * many villages there is no scalar anyone could have typed, and the number
 * that was there quietly answered a question nobody asked.
 *
 * So a village stores where it *is*, and distance is computed against whoever
 * is asking.
 *
 * Two deliberate limitations, both visible to the caller rather than buried:
 *
 *  - Great-circle distance is not road distance. Across the Dharmapuri and
 *    Salem ghats the road is routinely a third longer than the straight line,
 *    so the result is scaled by a road factor held in platform policy. It is a
 *    correction, not a route.
 *  - Nothing here knows about traffic, closures or vehicle class. When freight
 *    starts being charged on this number rather than estimated from it, this
 *    is the seam to replace with a routing service — same signature, cached
 *    per village pair, because villages do not move.
 */

export interface Point {
  readonly lat: number;
  readonly lng: number;
}

/** Mean Earth radius. Good to ~0.5% at the scale of one Indian state. */
const EARTH_RADIUS_KM = 6371;

export function isPoint(value: {
  lat?: number | null;
  lng?: number | null;
}): value is Point {
  return (
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    // 0,0 is in the Atlantic. It is what an unset pair of fields looks like
    // after a careless default, and it must not read as a valid location.
    !(value.lat === 0 && value.lng === 0)
  );
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(from: Point, to: Point): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Estimated road distance, rounded to whole kilometres.
 *
 * `roadFactorPercent` comes from platform policy — 130 means "roads here run
 * about 30% longer than the crow flies".
 */
export function roadKm(
  from: Point,
  to: Point,
  roadFactorPercent: number,
): number {
  return Math.round((haversineKm(from, to) * roadFactorPercent) / 100);
}

/**
 * Distance from a buyer to the nearest located place in a set.
 *
 * Returns `null` when either end has no coordinates, and the caller must show
 * that rather than substituting a number. A freight estimate invented from a
 * missing location is worse than no estimate: it is wrong and it looks right.
 */
export function nearestKm(
  from: Point | null,
  places: ReadonlyArray<{ lat?: number | null; lng?: number | null }>,
  roadFactorPercent: number,
): number | null {
  if (!from) return null;

  const located = places.filter(isPoint);
  if (located.length === 0) return null;

  return Math.min(...located.map((place) => roadKm(from, place, roadFactorPercent)));
}

/**
 * Parses whatever an operator pastes into the coordinate field.
 *
 * People do not type latitude and longitude; they copy them out of Google
 * Maps, which hands back several shapes depending on how you got there. All of
 * these arrive in practice:
 *
 *   12.7409, 77.8253
 *   12.7409,77.8253
 *   https://www.google.com/maps/@12.7409,77.8253,14z
 *   https://maps.google.com/?q=12.7409,77.8253
 *
 * Accepting only the bare pair means an operator retypes numbers by hand,
 * which is exactly where a transposed digit puts a village in the sea.
 */
export function parseCoordinates(input: string): Point | null {
  const text = input.trim();
  if (!text) return null;

  // First decimal pair anywhere in the string. Google Maps URLs put it after
  // an `@` or a `q=`, and both are covered by simply looking for the pair.
  const match = text.match(/(-?\d{1,3}\.\d+)[,\s/@]+(-?\d{1,3}\.\d+)/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

/**
 * The box India sits in, generously drawn.
 *
 * Not a validation of correctness — a village can be pinned in the wrong
 * district and this will not notice. It catches the failure that actually
 * happens: latitude and longitude entered the wrong way round, which for Tamil
 * Nadu lands the pin in Somalia and would otherwise produce a confident
 * four-thousand-kilometre freight estimate.
 */
const INDIA_BOUNDS = { minLat: 6, maxLat: 37, minLng: 68, maxLng: 98 };

export function isInIndia(point: Point): boolean {
  return (
    point.lat >= INDIA_BOUNDS.minLat &&
    point.lat <= INDIA_BOUNDS.maxLat &&
    point.lng >= INDIA_BOUNDS.minLng &&
    point.lng <= INDIA_BOUNDS.maxLng
  );
}

/** `12.7409, 77.8253` — how a coordinate is shown back. */
export function formatPoint(point: Point): string {
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}
