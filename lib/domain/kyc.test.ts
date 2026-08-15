import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/claims";
import {
  approve,
  isWellFormedAadhaar,
  isWellFormedGstin,
  KycError,
  kycProgress,
  kycState,
  maskAadhaar,
  needsHumanReview,
  outstandingChecks,
  recordEkyc,
  recordManual,
  reject,
  REQUIRED_CHECKS,
  type Check,
  type CheckKind,
} from "./kyc";

const NOW = new Date("2026-08-15T10:00:00+05:30");

function verified(kind: CheckKind): Check {
  return { kind, method: "ekyc", state: "verified", checkedAt: NOW };
}
function inReview(kind: CheckKind): Check {
  return { kind, method: "manual", state: "review", checkedAt: NOW };
}

describe("a manual submission cannot verify itself", () => {
  // The rule the whole feature rests on.
  it("always lands in review, whatever it is given", () => {
    for (const kind of ["identity", "pan", "gst", "bank", "fssai"] as CheckKind[]) {
      expect(recordManual(kind, "anything", NOW).state).toBe("review");
    }
  });

  it("leaves the account waiting for approval, not verified", () => {
    const checks = REQUIRED_CHECKS.farmer.map(inReview);
    expect(kycState(checks, "farmer")).toBe("awaitingApproval");
    expect(needsHumanReview(checks, "farmer")).toBe(true);
  });

  it("only approve() moves it, and only an operator can call that", () => {
    const submitted = recordManual("identity", "XXXX XXXX 1234", NOW);
    const approved = approve(submitted, "ops@srirealtime.com", NOW);
    expect(approved.state).toBe("verified");
    expect(approved.approvedBy).toBe("ops@srirealtime.com");
  });
});

describe("eKYC needs no approval", () => {
  it("verifies immediately when the authority says so", () => {
    const checks = REQUIRED_CHECKS.farmer.map((kind) =>
      recordEkyc(kind, { verified: true, verifiedName: "R. Murugan" }, NOW),
    );
    expect(kycState(checks, "farmer")).toBe("verified");
    // The point: nobody is asked to look at it.
    expect(needsHumanReview(checks, "farmer")).toBe(false);
  });

  it("fails closed when the authority disagrees", () => {
    const checks = [
      recordEkyc("identity", { verified: false, reason: "Name mismatch" }, NOW),
      verified("bank"),
    ];
    expect(kycState(checks, "farmer")).toBe("rejected");
  });

  it("refuses to let an operator approve an eKYC result", () => {
    // Approving a failed eKYC would be overriding UIDAI on a hunch, and the
    // record would show a verified identity with nothing behind it.
    const failed = recordEkyc("identity", { verified: false }, NOW);
    expect(() => approve(failed, "ops@srirealtime.com", NOW)).toThrow(KycError);
  });

  it("refuses to approve a check that is not waiting", () => {
    expect(() => approve(inReview("pan"), "ops", NOW)).not.toThrow();
    expect(() => approve({ ...inReview("pan"), state: "failed" }, "ops", NOW)).toThrow(KycError);
  });
});

describe("rejection", () => {
  it("records who refused it and why", () => {
    const out = reject(inReview("gst"), "ops@srirealtime.com", "Certificate unreadable", NOW);
    expect(out).toMatchObject({
      state: "failed",
      approvedBy: "ops@srirealtime.com",
      reason: "Certificate unreadable",
    });
  });

  it("refuses to reject something already verified", () => {
    // Withdrawing a verification suspends an account; it is not a check edit.
    expect(() => reject(verified("gst"), "ops", "changed my mind", NOW)).toThrow(KycError);
  });
});

describe("account state", () => {
  it("is verified only when every required check is", () => {
    const partial = [verified("identity")];
    expect(kycState(partial, "farmer")).toBe("inProgress");
    expect(kycState([...partial, verified("bank")], "farmer")).toBe("verified");
  });

  it("counts a rejection above everything else", () => {
    const checks: Check[] = [
      verified("identity"),
      { kind: "bank", method: "manual", state: "failed", checkedAt: NOW },
    ];
    // Not "in progress": an account with a refused check is not progressing.
    expect(kycState(checks, "farmer")).toBe("rejected");
  });

  it("ignores checks the role does not need", () => {
    // A farmer submitting a GSTIN does not thereby need one.
    const checks = [verified("identity"), verified("bank"), inReview("gst")];
    expect(kycState(checks, "farmer")).toBe("verified");
  });

  it("starts at notStarted and never skips a step", () => {
    expect(kycState([], "buyer")).toBe("notStarted");
    expect(kycState([verified("identity")], "buyer")).toBe("inProgress");
  });

  it("asks operations for nothing", () => {
    expect(REQUIRED_CHECKS.admin).toEqual([]);
    expect(kycState([], "admin")).toBe("verified");
  });

  it("gives every self-registering role something to clear", () => {
    for (const role of ROLES) {
      if (role === "admin") continue;
      expect(REQUIRED_CHECKS[role].length).toBeGreaterThan(0);
      // Identity is not optional for anyone who trades.
      expect(REQUIRED_CHECKS[role]).toContain("identity");
    }
  });

  it("asks a farmer for less than a business", () => {
    // Every extra field is a farmer who stops halfway.
    expect(REQUIRED_CHECKS.farmer.length).toBeLessThan(REQUIRED_CHECKS.buyer.length);
  });
});

describe("progress and what is left", () => {
  it("counts submitted as done, because the wait is not their fault", () => {
    expect(kycProgress([verified("identity"), inReview("bank")], "farmer")).toEqual({
      done: 2,
      total: 2,
    });
  });

  it("lists only what still needs doing", () => {
    expect(outstandingChecks([verified("identity")], "farmer")).toEqual(["bank"]);
    expect(outstandingChecks([verified("identity"), inReview("bank")], "farmer")).toEqual([]);
  });

  it("asks a failed check to be done again", () => {
    const failed: Check = { kind: "bank", method: "manual", state: "failed", checkedAt: NOW };
    expect(outstandingChecks([verified("identity"), failed], "farmer")).toEqual(["bank"]);
  });
});

describe("Aadhaar", () => {
  // Verhoeff-valid numbers. Fictitious, and valid only in the checksum sense —
  // which is exactly the distinction this module exists to make.
  const WELL_FORMED = ["234567890124", "999941057058", "999971658847"];

  it("accepts well-formed numbers", () => {
    for (const value of WELL_FORMED) expect(isWellFormedAadhaar(value)).toBe(true);
  });

  it("survives spaces, which is how everyone writes them", () => {
    expect(isWellFormedAadhaar("9999 4105 7058")).toBe(true);
  });

  it("catches a single mistyped digit", () => {
    expect(isWellFormedAadhaar("999941057059")).toBe(false);
  });

  it("catches transposed neighbours", () => {
    expect(isWellFormedAadhaar("999941057085")).toBe(false);
  });

  it("refuses numbers that cannot start an Aadhaar", () => {
    expect(isWellFormedAadhaar("012345678901")).toBe(false);
    expect(isWellFormedAadhaar("112345678901")).toBe(false);
  });

  it("refuses the wrong length and non-digits", () => {
    expect(isWellFormedAadhaar("99994105705")).toBe(false);
    expect(isWellFormedAadhaar("9999410570581")).toBe(false);
    expect(isWellFormedAadhaar("abcdefghijkl")).toBe(false);
  });

  it("stores only the last four digits", () => {
    // The legal line. Anything more is not permitted to a private platform.
    expect(maskAadhaar("999941057058")).toBe("XXXX XXXX 7058");
    expect(maskAadhaar("9999 4105 7058")).toBe("XXXX XXXX 7058");
    expect(maskAadhaar("999941057058")).not.toContain("9999410");
  });

  it("refuses to mask something that is not twelve digits", () => {
    expect(() => maskAadhaar("1234")).toThrow(KycError);
  });
});

describe("GSTIN", () => {
  it("accepts a valid check digit", () => {
    // Check digits computed from the algorithm itself, so these test the
    // implementation against the published scheme rather than against a number
    // somebody remembered.
    expect(isWellFormedGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isWellFormedGstin("29AAGCB7383J1Z4")).toBe(true);
    expect(isWellFormedGstin("33AAECK4521M1ZK")).toBe(true);
    expect(isWellFormedGstin("07AAACS8577K1ZR")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    // Same GSTIN, last character changed — the case a regex alone waves through.
    expect(isWellFormedGstin("27AAPFU0939F1ZA")).toBe(false);
  });

  it("rejects a mistyped body even when the shape is right", () => {
    expect(isWellFormedGstin("27AAPFU0939F1ZV".replace("0939", "0938"))).toBe(false);
  });

  it("rejects the wrong shape outright", () => {
    expect(isWellFormedGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isWellFormedGstin("")).toBe(false);
    expect(isWellFormedGstin("hello")).toBe(false);
  });

  it("is case- and space-insensitive, because forms are", () => {
    expect(isWellFormedGstin(" 27aapfu0939f1zv ")).toBe(true);
  });
});
