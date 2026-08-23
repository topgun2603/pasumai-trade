import { describe, expect, it } from "vitest";

import {
  INDIAN_STATES,
  districtsOf,
  isAmbiguousDistrict,
  isDistrictOf,
  stateById,
  stateNameForDistrict,
} from "./india";
import { GEOGRAPHY } from "@/lib/mock/locations";

/**
 * This list is address data for a marketplace, so the checks worth having are
 * the ones about it being the *country* rather than about it being well-formed:
 * the source was a pre-2019 snapshot that predated Ladakh, still split Dadra
 * and Nagar Haveli from Daman and Diu, and omitted Andaman and Nicobar.
 */
describe("India geography", () => {
  it("has all 28 states and 8 union territories", () => {
    expect(INDIAN_STATES).toHaveLength(36);
  });

  it("carries the reorganisations the source predated", () => {
    const names = INDIAN_STATES.map((state) => state.name);

    expect(names).toContain("Ladakh");
    expect(names).toContain("Andaman and Nicobar Islands");
    expect(names).toContain("Dadra and Nagar Haveli and Daman and Diu");
    // The two halves must not also survive separately, or a person from Daman
    // gets two plausible answers and operations gets two spellings of one place.
    expect(names).not.toContain("Daman and Diu");
    expect(names).not.toContain("Dadra and Nagar Haveli");
  });

  it("keeps the administrative suffixes out of the names people read", () => {
    for (const state of INDIAN_STATES) {
      expect(state.name, `${state.name} still carries a bracketed suffix`).not.toMatch(
        /\((?:UT|NCT)\)/i,
      );
    }
  });

  it("resolves the source's bracketed names without losing a district", () => {
    const ka = INDIAN_STATES.find((s) => s.name === "Karnataka")!;
    const ts = INDIAN_STATES.find((s) => s.name === "Telangana")!;

    // "Mysuru (Mysore)" in the source: the bracket is a former name.
    expect(ka.districts).toContain("Mysuru");
    expect(ka.districts).toContain("Bengaluru Rural");

    /*
      "Warangal (Rural)" and "Warangal (Urban)" are the exception — the bracket
      is the only thing telling them apart, so it becomes a suffix rather than
      being dropped and leaving one state with two districts called Warangal.
    */
    expect(ts.districts).toContain("Warangal Rural");
    expect(ts.districts).toContain("Warangal Urban");
    expect(ts.districts.filter((d) => d === "Warangal")).toHaveLength(0);
  });

  it("leaves no bracketed names for a person to read in a dropdown", () => {
    const brackets = INDIAN_STATES.flatMap((s) => s.districts).filter((d) => d.includes("("));
    expect(brackets).toEqual([]);
  });

  it("gives every state districts, with no duplicates inside one", () => {
    for (const state of INDIAN_STATES) {
      expect(state.districts.length, `${state.name} has no districts`).toBeGreaterThan(0);
      expect(new Set(state.districts).size, `${state.name} repeats a district`).toBe(
        state.districts.length,
      );
    }
  });

  /*
    The operational geography is a subset of the administrative one, and has to
    stay one: a district the platform serves that this list does not contain
    would be unreachable from the registration form, so nobody there could sign
    up for a place we actually cover.
  */
  it("contains every district the platform actually operates in", () => {
    for (const district of GEOGRAPHY.districts) {
      const state = GEOGRAPHY.states.find((s) => s.id === district.stateId);
      if (!state) continue;
      const match = INDIAN_STATES.find((s) => s.name === state.name);
      expect(match, `${state.name} is not in the India list`).toBeDefined();
      expect(
        isDistrictOf(match!.id, district.name),
        `${district.name} is served but is not a district of ${state.name}`,
      ).toBe(true);
    }
  });

  it("refuses a district paired with the wrong state", () => {
    const tn = INDIAN_STATES.find((s) => s.name === "Tamil Nadu")!;
    const pb = INDIAN_STATES.find((s) => s.name === "Punjab")!;

    expect(isDistrictOf(tn.id, "Erode")).toBe(true);
    expect(isDistrictOf(pb.id, "Erode")).toBe(false);
    // Case and padding come from a form, not from us.
    expect(isDistrictOf(tn.id, "  erode ")).toBe(true);
  });

  it("answers safely for a state id that does not exist", () => {
    expect(stateById("atlantis")).toBeUndefined();
    expect(districtsOf("atlantis")).toEqual([]);
    expect(isDistrictOf("atlantis", "Erode")).toBe(false);
  });
});

describe("finding a state from a district", () => {
  it("names the state for a district only one state has", () => {
    expect(stateNameForDistrict("Erode")).toBe("Tamil Nadu");
    expect(stateNameForDistrict("Tiruppur")).toBe("Tamil Nadu");
  });

  it("ignores case and stray spacing", () => {
    expect(stateNameForDistrict("  erode ")).toBe("Tamil Nadu");
  });

  /*
    The case worth having the function for. Showing a farmer in Bihar the
    mandi rates from Maharashtra would be a wrong number presented as a right
    one; falling back to a default is a mild loss by comparison.
  */
  it("refuses a district name two states share", () => {
    expect(stateNameForDistrict("Aurangabad")).toBeUndefined();
    expect(isAmbiguousDistrict("Aurangabad")).toBe(true);
  });

  it("says nothing for a district that does not exist", () => {
    expect(stateNameForDistrict("Nowhere")).toBeUndefined();
    expect(stateNameForDistrict("")).toBeUndefined();
    // Absent is not the same as ambiguous.
    expect(isAmbiguousDistrict("Nowhere")).toBe(false);
  });
});
