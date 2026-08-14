import { describe, expect, it } from "vitest";

import {
  formatPoint,
  haversineKm,
  isInIndia,
  isPoint,
  nearestKm,
  parseCoordinates,
  roadKm,
} from "./distance";

/**
 * Real coordinates, so the expected distances are checkable against a map
 * rather than against whatever this code happened to produce first.
 */
const HOSUR = { lat: 12.7409, lng: 77.8253 };
const COIMBATORE = { lat: 11.0168, lng: 76.9558 };
const KAVERIPATTINAM = { lat: 12.4204, lng: 78.2166 };
const THANJAVUR = { lat: 10.787, lng: 79.1378 };

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(HOSUR, HOSUR)).toBe(0);
  });

  it("matches known distances to within a percent", () => {
    // Hosur to Coimbatore is about 215 km straight line.
    expect(haversineKm(HOSUR, COIMBATORE)).toBeGreaterThan(210);
    expect(haversineKm(HOSUR, COIMBATORE)).toBeLessThan(220);

    // Hosur to Kaveripattinam, about 55 km.
    expect(haversineKm(HOSUR, KAVERIPATTINAM)).toBeGreaterThan(50);
    expect(haversineKm(HOSUR, KAVERIPATTINAM)).toBeLessThan(60);
  });

  it("is symmetric", () => {
    expect(haversineKm(HOSUR, THANJAVUR)).toBeCloseTo(
      haversineKm(THANJAVUR, HOSUR),
      6,
    );
  });
});

describe("roadKm", () => {
  it("scales the straight line by the road factor", () => {
    const straight = haversineKm(HOSUR, KAVERIPATTINAM);
    expect(roadKm(HOSUR, KAVERIPATTINAM, 130)).toBe(Math.round(straight * 1.3));
  });

  it("returns the straight line at a factor of 100", () => {
    expect(roadKm(HOSUR, COIMBATORE, 100)).toBe(
      Math.round(haversineKm(HOSUR, COIMBATORE)),
    );
  });
});

describe("isPoint", () => {
  it("accepts a real coordinate", () => {
    expect(isPoint(HOSUR)).toBe(true);
  });

  it("rejects missing or non-finite values", () => {
    expect(isPoint({ lat: null, lng: null })).toBe(false);
    expect(isPoint({ lat: 12.74, lng: null })).toBe(false);
    expect(isPoint({ lat: NaN, lng: 77.8 })).toBe(false);
  });

  it("rejects null island", () => {
    // 0,0 is what unset fields look like after a careless default, and it
    // would otherwise read as a valid location in the Atlantic.
    expect(isPoint({ lat: 0, lng: 0 })).toBe(false);
  });
});

describe("nearestKm", () => {
  const places = [
    { ...KAVERIPATTINAM },
    { ...THANJAVUR },
    { lat: null, lng: null },
  ];

  it("finds the closest located place", () => {
    const fromHosur = nearestKm(HOSUR, places, 130);
    expect(fromHosur).toBe(roadKm(HOSUR, KAVERIPATTINAM, 130));
  });

  it("changes with who is asking — the whole point of the module", () => {
    // The same village is near one buyer and far from another. A stored
    // scalar could never express this.
    const fromHosur = nearestKm(HOSUR, [KAVERIPATTINAM], 130)!;
    const fromCoimbatore = nearestKm(COIMBATORE, [KAVERIPATTINAM], 130)!;
    expect(fromCoimbatore).toBeGreaterThan(fromHosur * 2);
  });

  it("returns null when the buyer has no location", () => {
    expect(nearestKm(null, places, 130)).toBeNull();
  });

  it("returns null when nothing in the set is located", () => {
    // Never a substituted number: a freight estimate invented from a missing
    // location is wrong and looks right.
    expect(nearestKm(HOSUR, [{ lat: null, lng: null }], 130)).toBeNull();
    expect(nearestKm(HOSUR, [], 130)).toBeNull();
  });
});

describe("parseCoordinates", () => {
  it("reads a plain pair, spaced or not", () => {
    expect(parseCoordinates("12.7409, 77.8253")).toEqual(HOSUR);
    expect(parseCoordinates("12.7409,77.8253")).toEqual(HOSUR);
    expect(parseCoordinates("  12.7409   77.8253 ")).toEqual(HOSUR);
  });

  it("reads what Google Maps puts on the clipboard", () => {
    expect(
      parseCoordinates("https://www.google.com/maps/@12.7409,77.8253,14z"),
    ).toEqual(HOSUR);
    expect(parseCoordinates("https://maps.google.com/?q=12.7409,77.8253")).toEqual(
      HOSUR,
    );
  });

  it("rejects text with no coordinate in it", () => {
    expect(parseCoordinates("")).toBeNull();
    expect(parseCoordinates("Kaveripattinam")).toBeNull();
    expect(parseCoordinates("635112")).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(parseCoordinates("112.7409, 77.8253")).toBeNull();
    expect(parseCoordinates("12.7409, 277.8253")).toBeNull();
  });

  it("rejects null island", () => {
    expect(parseCoordinates("0.0, 0.0")).toBeNull();
  });
});

describe("isInIndia", () => {
  it("accepts places the platform actually operates in", () => {
    for (const point of [HOSUR, COIMBATORE, KAVERIPATTINAM, THANJAVUR]) {
      expect(isInIndia(point)).toBe(true);
    }
  });

  it("catches latitude and longitude entered the wrong way round", () => {
    // Swapping Hosur's pair lands it off Somalia, which would otherwise give a
    // confident four-thousand-kilometre freight estimate.
    expect(isInIndia({ lat: 77.8253, lng: 12.7409 })).toBe(false);
  });
});

describe("formatPoint", () => {
  it("shows four decimals — about eleven metres, enough for a village", () => {
    expect(formatPoint(HOSUR)).toBe("12.7409, 77.8253");
    expect(formatPoint({ lat: 12.7, lng: 77.8 })).toBe("12.7000, 77.8000");
  });
});
