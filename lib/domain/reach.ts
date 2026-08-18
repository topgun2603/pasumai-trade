/**
 * How far the platform reaches, as the landing page states it.
 *
 * Three numbers under the hero: villages covered, districts, farmers
 * registered. Until now all three were arithmetic over `lib/mock/locations` —
 * seeded coverage that would have gone on saying the same thing however many
 * farmers actually signed up. They come from the database now.
 *
 * ## The floor
 *
 * A launch figure is kept per number, and the larger of the two is shown. A
 * platform with four farmers on it that says so on its front page is a platform
 * nobody joins; the floor is what the section showed before any of this was
 * wired, so nothing on the page regresses on the day it goes live.
 *
 * **It is worth being clear about what that means.** While the real number is
 * below its floor, the page states a figure larger than the truth. That is a
 * decision about how to present a young platform, not a technical detail, and
 * it is kept in one named constant so it can be lowered or zeroed in one edit —
 * `SHOWCASE_FLOOR`, below. Set a floor to `0` and that number is only ever the
 * real one. `isReal` on each figure says which kind it currently is, so a
 * caller that wants to mark or hide the difference can.
 */

export interface Reach {
  /** Villages the platform collects from. */
  readonly villages: number;
  readonly districts: number;
  readonly farmers: number;
}

/**
 * What each number shows until the platform's own has caught up.
 *
 * These are the values the page displayed when every figure was derived from
 * seeded geography, so switching to live data changes nothing visible on day
 * one and everything on the day the platform overtakes them.
 */
export const SHOWCASE_FLOOR: Reach = {
  villages: 12,
  districts: 6,
  farmers: 295,
};

export interface Figure {
  readonly value: number;
  /**
   * True once the platform's own count has reached the floor.
   *
   * From that moment the floor is never consulted again for this number: it
   * cannot pull a real figure down, only hold a small one up.
   */
  readonly isReal: boolean;
}

/** The larger of the two, and which one it was. */
export function showcase(real: number, floor: number): Figure {
  // A negative or missing count is a read that went wrong, not a platform that
  // shrank. Treated as nothing known rather than allowed to drag the figure
  // below its floor.
  const counted = Number.isFinite(real) && real > 0 ? Math.floor(real) : 0;
  return counted >= floor ? { value: counted, isReal: true } : { value: floor, isReal: false };
}

export interface ShownReach {
  readonly villages: Figure;
  readonly districts: Figure;
  readonly farmers: Figure;
  /** True when every number on the page is the platform's own. */
  readonly allReal: boolean;
}

export function reachToShow(real: Reach, floor: Reach = SHOWCASE_FLOOR): ShownReach {
  const villages = showcase(real.villages, floor.villages);
  const districts = showcase(real.districts, floor.districts);
  const farmers = showcase(real.farmers, floor.farmers);

  return {
    villages,
    districts,
    farmers,
    allReal: villages.isReal && districts.isReal && farmers.isReal,
  };
}
