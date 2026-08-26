import { describe, expect, it } from "vitest";

import { reachToShow, showcase, SHOWCASE_FLOOR, type Reach } from "./reach";

describe("the showcase floor", () => {
  it("holds a small number up to the launch figure", () => {
    expect(showcase(4, 295)).toEqual({ value: 295, isReal: false });
  });

  it("hands over the moment the real count reaches it", () => {
    expect(showcase(295, 295)).toEqual({ value: 295, isReal: true });
  });

  it("never pulls a real figure down to the floor", () => {
    // The floor can only hold a number up. A platform past its launch figure
    // must not go on advertising the launch figure.
    expect(showcase(1200, 295)).toEqual({ value: 1200, isReal: true });
  });

  it("is switched off entirely by a floor of zero", () => {
    expect(showcase(4, 0)).toEqual({ value: 4, isReal: true });
    expect(showcase(0, 0)).toEqual({ value: 0, isReal: true });
  });

  it("treats a failed count as nothing known rather than as a collapse", () => {
    expect(showcase(-1, 12)).toEqual({ value: 12, isReal: false });
    expect(showcase(Number.NaN, 12)).toEqual({ value: 12, isReal: false });
  });

  it("does not invent a fraction of a district", () => {
    expect(showcase(12.9, 0).value).toBe(12);
  });
});

describe("the two figures together", () => {
  const real: Reach = { states: 1, districts: 9 };

  it("mixes real and floor per number", () => {
    const shown = reachToShow(real);
    // One state is below the floor of two, nine districts is above six. The
    // page shows a held-up figure beside a true one, which is the whole point
    // of holding each number separately.
    expect(shown.states).toEqual({ value: 2, isReal: false });
    expect(shown.districts).toEqual({ value: 9, isReal: true });
  });

  it("says so only when every number is the platform's own", () => {
    expect(reachToShow(real).allReal).toBe(false);
    expect(reachToShow({ states: 4, districts: 9 }).allReal).toBe(true);
  });

  it("shows the launch figures when the platform knows nothing yet", () => {
    const shown = reachToShow({ states: 0, districts: 0 });
    expect(shown.states.value).toBe(SHOWCASE_FLOOR.states);
    expect(shown.districts.value).toBe(SHOWCASE_FLOOR.districts);
    expect(shown.allReal).toBe(false);
  });
});
