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

  it("does not invent a fraction of a village", () => {
    expect(showcase(12.9, 0).value).toBe(12);
  });
});

describe("the three figures together", () => {
  const real: Reach = { villages: 14, districts: 6, farmers: 4 };

  it("mixes real and floor per number", () => {
    const shown = reachToShow(real);
    expect(shown.villages).toEqual({ value: 14, isReal: true });
    expect(shown.districts).toEqual({ value: 6, isReal: true });
    expect(shown.farmers).toEqual({ value: 295, isReal: false });
  });

  it("says so only when every number is the platform's own", () => {
    expect(reachToShow(real).allReal).toBe(false);
    expect(reachToShow({ villages: 20, districts: 9, farmers: 400 }).allReal).toBe(true);
  });

  it("shows the launch figures when the platform knows nothing yet", () => {
    const shown = reachToShow({ villages: 0, districts: 0, farmers: 0 });
    expect(shown.villages.value).toBe(SHOWCASE_FLOOR.villages);
    expect(shown.farmers.value).toBe(SHOWCASE_FLOOR.farmers);
    expect(shown.allReal).toBe(false);
  });
});
