import { describe, expect, it } from "vitest";

import { formatRegistration } from "./registration";

describe("showing a number plate", () => {
  /*
    Stored without spaces so a lookup agrees with itself — "tn 38 aa 1234" and
    "TN38AA1234" are the same lorry. Shown with them, because that is how a
    plate is painted.

    Before this the fleet table rendered a filed vehicle as TN33AB4471 and a
    seeded one as TN 20 BA 4471: one field, two formats, depending on where the
    row came from.
  */
  it("groups a canonical plate the way it is painted", () => {
    expect(formatRegistration("TN33AB4471")).toBe("TN 33 AB 4471");
    expect(formatRegistration("TN20BA4471")).toBe("TN 20 BA 4471");
  });

  it("regroups one that was stored with spaces already", () => {
    expect(formatRegistration("TN 20 BA 4471")).toBe("TN 20 BA 4471");
    expect(formatRegistration("tn 33 ab 4471")).toBe("TN 33 AB 4471");
  });

  it("takes the shorter series and single-digit RTO some states use", () => {
    expect(formatRegistration("DL1C1234")).toBe("DL 1 C 1234");
    expect(formatRegistration("KA05MH99")).toBe("KA 05 MH 99");
  });

  it("leaves an unrecognised plate alone rather than mangling it", () => {
    // A format this does not know is still somebody's lorry, and a mangled
    // plate is worse than an unformatted one.
    expect(formatRegistration("XX-9999")).toBe("XX-9999");
    expect(formatRegistration("")).toBe("");
  });
});
