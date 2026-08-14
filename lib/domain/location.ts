/**
 * Where things are.
 *
 * A three-level hierarchy — **state → district → place** — held as reference
 * data and used for every location field on the platform: farmer addresses,
 * buyer sourcing scope, market filters, dispatch routing.
 *
 * Two things this replaces, and why:
 *
 *  - **Collection points are gone.** They were a modelling error: an invented
 *    pooling shed that contradicted how the platform actually works. Produce
 *    is collected *at the farm*, graded in front of the farmer, and loaded
 *    there. There is no intermediate building, so there is no entity for one.
 *
 *  - **Free-text districts are gone.** A district typed into a form is a
 *    district that will be spelled three ways by three people and will not
 *    match a filter. Locations are records with ids, so a rename in Controls
 *    fixes every screen at once.
 *
 * Pickup is therefore addressed by *place*, and a dispatch covers the places
 * within one district — one vehicle, one district run. That is what makes
 * "one order is one dispatch" true without inventing a warehouse.
 */

import { isPoint, roadKm, type Point } from "./distance";

export interface State {
  readonly id: string;
  readonly name: string;
  /** What the state calls itself. Shown in its own script. */
  readonly nativeName: string;
  /** Primary language there, for defaulting a farmer's app language. */
  readonly locale: string;
  /** Registration prefix — `TN`, `KA`. Validates vehicle numbers per state. */
  readonly vehiclePrefix: string;
  readonly active: boolean;
}

export interface District {
  readonly id: string;
  readonly stateId: string;
  readonly name: string;
  readonly nativeName?: string;
  /**
   * Smallest order the platform will run a vehicle for here, in paise.
   *
   * Per district because it is a freight decision: a thin, distant district
   * needs a bigger load to be worth the run. Absent falls back to the platform
   * default rather than to zero — a missing figure must never mean "any order
   * will do".
   */
  readonly minOrderValue?: number | null;
  readonly active: boolean;
}

/**
 * A village or town. The finest granularity the platform addresses.
 *
 * A place stores **where it is**, not how far away it is. Distance is not a
 * property of a village — it is a property of a village and a buyer together,
 * and with many buyers there is no single number anyone could store. See
 * `lib/domain/distance.ts`, which computes it against whoever is asking.
 *
 * Coordinates are optional because a village can be registered before anyone
 * has pinned it. Everything that needs a distance must handle their absence by
 * saying so, never by substituting a figure.
 */
export interface Place {
  readonly id: string;
  readonly districtId: string;
  readonly name: string;
  readonly nativeName?: string;
  readonly pincode: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  /** Farmers registered here. A thin pool is a supply risk worth surfacing. */
  readonly farmerCount: number;
  readonly active: boolean;
}

/** The whole hierarchy, as it is loaded and passed around. */
export interface Geography {
  readonly states: readonly State[];
  readonly districts: readonly District[];
  readonly places: readonly Place[];
}

/* -------------------------------------------------------------------------
   Lookups
   ------------------------------------------------------------------------- */

export function districtsIn(geo: Geography, stateId: string): District[] {
  return geo.districts
    .filter((d) => d.stateId === stateId && d.active)
    .sort((a, b) => a.name.localeCompare(b.name, "en-IN"));
}

export function placesIn(geo: Geography, districtId: string): Place[] {
  return geo.places
    .filter((p) => p.districtId === districtId && p.active)
    .sort((a, b) => a.name.localeCompare(b.name, "en-IN"));
}

export function findState(geo: Geography, id: string): State | undefined {
  return geo.states.find((s) => s.id === id);
}

export function findDistrict(geo: Geography, id: string): District | undefined {
  return geo.districts.find((d) => d.id === id);
}

export function findPlace(geo: Geography, id: string): Place | undefined {
  return geo.places.find((p) => p.id === id);
}

/** `Kaveripattinam, Krishnagiri, Tamil Nadu` — for display in one line. */
export function describePlace(geo: Geography, placeId: string): string {
  const place = findPlace(geo, placeId);
  if (!place) return "Unknown";
  const district = findDistrict(geo, place.districtId);
  const state = district ? findState(geo, district.stateId) : undefined;
  return [place.name, district?.name, state?.name].filter(Boolean).join(", ");
}

/** Every place inside a district, plus its farmer total. */
export function districtSummary(
  geo: Geography,
  districtId: string,
): { places: number; farmers: number } {
  const places = placesIn(geo, districtId);
  return {
    places: places.length,
    farmers: places.reduce((total, p) => total + p.farmerCount, 0),
  };
}

/**
 * Nearest place first, from a given point.
 *
 * Distance is the buyer's first question about a load — it decides freight and
 * how fresh produce arrives — so it is the natural default order. It takes the
 * asking point because there is no such thing as "near" without one.
 *
 * Places with no coordinates sort last rather than first. They are unknown,
 * not close, and an unpinned village at the top of a nearest-first list is the
 * one a buyer would wrongly reach for.
 */
export function byDistanceFrom(
  from: Point | null,
  roadFactorPercent: number,
): (a: Place, b: Place) => number {
  return (a, b) => {
    if (!from) return a.name.localeCompare(b.name, "en-IN");
    const da = isPoint(a) ? roadKm(from, a, roadFactorPercent) : Infinity;
    const db = isPoint(b) ? roadKm(from, b, roadFactorPercent) : Infinity;
    if (da === db) return a.name.localeCompare(b.name, "en-IN");
    return da - db;
  };
}
