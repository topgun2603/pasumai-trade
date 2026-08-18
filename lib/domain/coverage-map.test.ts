import { describe, expect, it } from "vitest";

import { boundsOf, groupNearby, isPlottable, type MappedPlace } from "./coverage-map";

function place(id: string, lat: number, lng: number): MappedPlace {
  return { id, name: id, districtName: "Erode", farmerCount: 10, lat, lng };
}

describe("a coordinate worth plotting", () => {
  it("accepts a real village", () => {
    expect(isPlottable(11.4453, 77.6819)).toBe(true);
  });

  it("rejects a field left at zero", () => {
    // Null Island is off the coast of Africa. A pin there is a missing value
    // wearing a coordinate.
    expect(isPlottable(0, 0)).toBe(false);
  });

  it("rejects a swapped pair", () => {
    // 77.68 N is in the Arctic. This is the mistake that actually happens.
    expect(isPlottable(77.6819, 11.4453)).toBe(false);
  });

  it("rejects a place with no coordinates at all", () => {
    expect(isPlottable(undefined, undefined)).toBe(false);
    expect(isPlottable(null, null)).toBe(false);
    expect(isPlottable(Number.NaN, 78)).toBe(false);
  });
});

describe("the box around the pins", () => {
  it("holds every point with room to spare", () => {
    const bounds = boundsOf([{ lat: 10, lng: 77 }, { lat: 12, lng: 79 }], 0.5);
    expect(bounds).toEqual({ west: 76.5, south: 9.5, east: 79.5, north: 12.5 });
  });

  it("has no box for no points", () => {
    // A caller must fall back to the whole country rather than to a
    // degenerate view of nothing.
    expect(boundsOf([])).toBeNull();
  });

  it("still gives a usable box for a single village", () => {
    const bounds = boundsOf([{ lat: 11, lng: 78 }], 0.6)!;
    expect(bounds.east - bounds.west).toBeCloseTo(1.2);
    expect(bounds.north - bounds.south).toBeCloseTo(1.2);
  });
});

describe("villages that share a spot", () => {
  it("counts neighbours as one pin", () => {
    // Papanasam and Kumbakonam are about 12 km apart and draw as one blob at
    // the zoom this map uses. A grid-rounding version of this put them in
    // different cells, which is the bug the distance test exists to hold.
    const grouped = groupNearby([
      place("kumbakonam", 10.9601, 79.3788),
      place("papanasam", 10.9265, 79.2705),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].places).toHaveLength(2);
  });

  it("keeps distant villages apart", () => {
    const grouped = groupNearby([
      place("hosur", 12.7409, 77.8253),
      place("kumbakonam", 10.9601, 79.3788),
    ]);
    expect(grouped).toHaveLength(2);
  });

  it("does not depend on the order they were read in", () => {
    const a = place("kumbakonam", 10.9601, 79.3788);
    const b = place("papanasam", 10.9265, 79.2705);
    expect(groupNearby([a, b])[0].lat).toBeCloseTo(groupNearby([b, a])[0].lat);
  });

  it("puts a shared pin between the villages it stands for", () => {
    const grouped = groupNearby([place("a", 11.0, 79.0), place("b", 11.02, 79.04)]);
    expect(grouped[0].lat).toBeCloseTo(11.01);
    expect(grouped[0].lng).toBeCloseTo(79.02);
  });

  it("has nothing to group when there is nothing", () => {
    expect(groupNearby([])).toEqual([]);
  });
});
