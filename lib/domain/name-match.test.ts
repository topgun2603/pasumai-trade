import { describe, expect, it } from "vitest";

import { compareNames, matchClearsAutomatically } from "./name-match";

describe("comparing a name against the one a bank holds", () => {
  it("ignores case, stops and spacing", () => {
    expect(compareNames("R. Murugan", "R MURUGAN")).toBe("exact");
    expect(compareNames("  murugan   r  ", "MURUGAN R")).toBe("exact");
  });

  /*
    The case this function exists for. Which order a bank stores a name in is
    not something the platform or the farmer controls, and treating the two
    orders as different people would fail a large share of genuine accounts.
  */
  it("does not care which way round the parts are", () => {
    expect(compareNames("Murugan Ramasamy", "RAMASAMY MURUGAN")).toBe("exact");
  });

  it("drops honorifics the bank printed into the field", () => {
    expect(compareNames("Selvi M", "SMT. M SELVI")).toBe("exact");
    expect(compareNames("Kongu Agri Traders", "M/S KONGU AGRI TRADERS")).toBe(
      "exact",
    );
  });

  /*
    An initial standing for a full name is consistent, not identical — a person
    decides. This is the single most common shape in Tamil Nadu, where the
    father's name leads as an initial.
  */
  it("calls an expanded initial close, not exact", () => {
    expect(compareNames("R Murugan", "RAMASAMY MURUGAN")).toBe("close");
    expect(compareNames("Ezhilarasi T", "EZHILARASI THANGAVEL")).toBe("close");
  });

  it("calls an extra name part close", () => {
    expect(compareNames("Arumugam K", "ARUMUGAM KANDASAMY PILLAI")).toBe(
      "close",
    );
  });

  /*
    A prefix is not an initial. Collapsing "RAM" into "RAMASAMY" would make
    different names agree, which is the failure that costs money rather than
    the one that costs a phone call.
  */
  it("expands only a single letter, never a prefix", () => {
    expect(compareNames("Ram Murugan", "RAMASAMY MURUGAN")).toBe("mismatch");
  });

  it("refuses two different people", () => {
    expect(compareNames("R Murugan", "K ARUMUGAM")).toBe("mismatch");
    expect(compareNames("Kongu Agri Traders", "BHAVANI FRESH SUPPLIES")).toBe(
      "mismatch",
    );
  });

  /*
    A given name on its own is shared by a great many people in one district.
    Matching on it would let a wrong account pass because one word agreed.
  */
  it("will not verify on a single matching word", () => {
    expect(compareNames("Murugan", "MURUGAN RAMASAMY")).toBe("mismatch");
  });

  /*
    An empty registered name is what a bank returns for an account it could not
    resolve. Reading that as agreement would verify every failed lookup.
  */
  it("treats an empty name as no evidence at all", () => {
    expect(compareNames("R Murugan", "")).toBe("mismatch");
    expect(compareNames("", "")).toBe("mismatch");
    expect(compareNames("R Murugan", "   .  ")).toBe("mismatch");
  });

  it("clears automatically only on an exact match", () => {
    expect(matchClearsAutomatically("exact")).toBe(true);
    expect(matchClearsAutomatically("close")).toBe(false);
    expect(matchClearsAutomatically("mismatch")).toBe(false);
  });
});
