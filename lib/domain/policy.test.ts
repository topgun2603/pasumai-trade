import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLICY,
  freshnessBands,
  POLICY_FIELDS,
  readPolicy,
} from "./policy";

describe("readPolicy", () => {
  it("returns the shipped values when nothing is stored", () => {
    expect(readPolicy(undefined)).toEqual(DEFAULT_POLICY);
  });

  it("falls back field by field, not all or nothing", () => {
    // A document written before a field existed must adopt the default for
    // that one field rather than being discarded whole.
    const policy = readPolicy({ expiringSoonDays: 14 });
    expect(policy.expiringSoonDays).toBe(14);
    expect(policy.thinSupplyFarmers).toBe(DEFAULT_POLICY.thinSupplyFarmers);
  });

  it("ignores values that are not finite numbers", () => {
    const policy = readPolicy({
      expiringSoonDays: "soon",
      thinSupplyFarmers: NaN,
      useSoonHours: Infinity,
    });
    expect(policy.expiringSoonDays).toBe(DEFAULT_POLICY.expiringSoonDays);
    expect(policy.thinSupplyFarmers).toBe(DEFAULT_POLICY.thinSupplyFarmers);
    expect(policy.useSoonHours).toBe(DEFAULT_POLICY.useSoonHours);
  });

  it("declares every field it can read", () => {
    // A field added to the interface but not to POLICY_FIELDS would be
    // invisible in the editor and unvalidated on write.
    const declared = POLICY_FIELDS.map((f) => f.key).sort();
    expect(declared).toEqual(Object.keys(DEFAULT_POLICY).sort());
  });

  it("gives every default a value inside its own declared bounds", () => {
    for (const field of POLICY_FIELDS) {
      expect(DEFAULT_POLICY[field.key]).toBeGreaterThanOrEqual(field.min);
      expect(DEFAULT_POLICY[field.key]).toBeLessThanOrEqual(field.max);
    }
  });
});

describe("freshnessBands", () => {
  it("uses the platform bands when a crop sets no shelf life", () => {
    expect(freshnessBands(DEFAULT_POLICY)).toEqual({ endOfLife: 24, useSoon: 60 });
    expect(freshnessBands(DEFAULT_POLICY, null)).toEqual({
      endOfLife: 24,
      useSoon: 60,
    });
  });

  it("scales the bands to the crop", () => {
    // Turmeric keeps for months; sixty hours left is not "use soon".
    const turmeric = freshnessBands(DEFAULT_POLICY, 4000);
    expect(turmeric.endOfLife).toBe(400);
    expect(turmeric.useSoon).toBe(1000);

    // A mango with twenty hours left is not fresh.
    const mango = freshnessBands(DEFAULT_POLICY, 64);
    expect(mango.endOfLife).toBe(6);
    expect(mango.useSoon).toBe(16);
  });

  it("keeps the bands apart even for a very short-lived crop", () => {
    const bands = freshnessBands(DEFAULT_POLICY, 4);
    expect(bands.useSoon).toBeGreaterThan(bands.endOfLife);
  });

  it("treats a nonsense shelf life as unset rather than as zero", () => {
    // Zero bands would mark every lot fresh right up to the moment it expires.
    expect(freshnessBands(DEFAULT_POLICY, 0)).toEqual({ endOfLife: 24, useSoon: 60 });
    expect(freshnessBands(DEFAULT_POLICY, -5)).toEqual({ endOfLife: 24, useSoon: 60 });
  });
});
