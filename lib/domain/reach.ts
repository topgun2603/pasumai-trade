/**
 * How far the platform reaches, as the landing page states it.
 *
 * Two numbers under the hero: states and districts.
 *
 * There were three, and they were the wrong three — villages, districts and
 * farmers. Villages and farmers are the bottom of the hierarchy, and a
 * platform that leads with them is describing how small it is: 13 villages
 * reads as thirteen villages. States and districts are the level the platform
 * is actually organised at, they are the level a buyer in another state cares
 * about, and they are what the reach genuinely is.
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
  /** States the platform operates in. */
  readonly states: number;
  readonly districts: number;
}

/**
 * What each number shows until the platform's own has caught up.
 *
 * These are the values the page displayed when every figure was derived from
 * seeded geography, so switching to live data changes nothing visible on day
 * one and everything on the day the platform overtakes them.
 */
export const SHOWCASE_FLOOR: Reach = {
  states: 2,
  districts: 6,
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
  readonly states: Figure;
  readonly districts: Figure;
  /** True when every number on the page is the platform's own. */
  readonly allReal: boolean;
}

export function reachToShow(real: Reach, floor: Reach = SHOWCASE_FLOOR): ShownReach {
  const states = showcase(real.states, floor.states);
  const districts = showcase(real.districts, floor.districts);

  return { states, districts, allReal: states.isReal && districts.isReal };
}
