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
  OPTIONAL_CHECKS,
  REQUIRED_CHECKS,
  type Check,
  type CheckKind,
  askForMore,
  askForReupload,
  respond,
  waitingOn,
  type CheckState,
  isDocumentType,
  withDocuments,
  MAX_DOCUMENTS_KEPT,
  type KycDocument,
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

  it("never requires a GSTIN of anybody", () => {
    // Businesses under the threshold and composition dealers do not hold one,
    // and refusing them the market over it would be refusing real customers.
    for (const role of ROLES) {
      expect(REQUIRED_CHECKS[role]).not.toContain("gst");
    }
    expect(OPTIONAL_CHECKS.buyer).toContain("gst");
    expect(OPTIONAL_CHECKS.franchise).toContain("gst");
  });

  it("verifies a buyer who never gives one", () => {
    const checks = REQUIRED_CHECKS.buyer.map(verified);
    expect(kycState(checks, "buyer")).toBe("verified");
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
  it("accepts the documented shape", () => {
    expect(isWellFormedGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isWellFormedGstin("29AAGCB7383J1ZL")).toBe(true);
    expect(isWellFormedGstin("07AABCS1429B1ZS")).toBe(true);
  });

  it("rejects the wrong shape outright", () => {
    expect(isWellFormedGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isWellFormedGstin("")).toBe(false);
    expect(isWellFormedGstin("hello")).toBe(false);
    // The fourteenth character is always Z.
    expect(isWellFormedGstin("27AAPFU0939F1XV")).toBe(false);
  });

  it("is case- and space-insensitive, because forms are", () => {
    expect(isWellFormedGstin(" 27aapfu0939f1zv ")).toBe(true);
  });

  it("does not check the check digit, on purpose", () => {
    // A validator nobody can prove correct is a door that sticks. Refusing a
    // real GSTIN costs a customer; accepting a mistyped one costs an operator
    // ten seconds at review, where it is checked against the register anyway.
    expect(isWellFormedGstin("27AAPFU0939F1ZA")).toBe(true);
  });
});

/**
 * The middle ground between approving and refusing.
 *
 * Operations could previously only say yes or no. Most of what actually comes
 * back from a queue is neither: a certificate in a slightly different company
 * name, a photograph with the corner cut off. Refusing those sends somebody to
 * the back of a queue over something a sentence settles.
 */
describe("asking rather than deciding", () => {
  const submitted = () => recordManual("bank", "HDFC0001234", NOW);

  it("asks a question and waits on the applicant", () => {
    const asked = askForMore(submitted(), "ops@pasumai", "Whose name is the account in?", NOW);
    expect(asked.state).toBe("moreInfo");
    expect(asked.reason).toContain("Whose name");
    expect(waitingOn(asked.state)).toBe("applicant");
  });

  it("asks for the document again, which is a different fix", () => {
    const asked = askForReupload(submitted(), "ops@pasumai", "The bottom edge is cut off.", NOW);
    expect(asked.state).toBe("reupload");
    expect(waitingOn(asked.state)).toBe("applicant");
  });

  it("refuses to ask for nothing", () => {
    // "More information needed" with no question is a delay the applicant
    // cannot act on, and "upload it again" with no reason produces the same
    // photograph.
    expect(() => askForMore(submitted(), "ops", "  ", NOW)).toThrow(KycError);
    expect(() => askForReupload(submitted(), "ops", "", NOW)).toThrow(KycError);
  });

  it("will not reopen something already verified", () => {
    const done = approve(submitted(), "ops@pasumai", NOW);
    expect(() => askForMore(done, "ops", "One more thing?", NOW)).toThrow(KycError);
    expect(() => askForReupload(done, "ops", "Again please", NOW)).toThrow(KycError);
  });

  it("puts an answer back in front of operations", () => {
    const asked = askForMore(submitted(), "ops@pasumai", "Whose name?", NOW);
    const answered = respond(asked, "It is my father's account.", NOW);

    expect(answered.state).toBe("review");
    expect(waitingOn(answered.state)).toBe("operations");
    // The question is answered; leaving it as the reason would show a query on
    // a check that is now ours to look at.
    expect(answered.reason).toBeUndefined();
  });

  it("refuses an answer to a question nobody asked", () => {
    expect(() => respond(submitted(), "Here you go", NOW)).toThrow(KycError);
  });

  it("keeps the whole conversation, oldest first", () => {
    // Rejected with no history is a dead end somebody then telephones about.
    let check = submitted();
    check = askForReupload(check, "ops@pasumai", "Too blurred to read.", NOW);
    check = respond(check, undefined, NOW);
    check = askForMore(check, "ops@pasumai", "Whose name is it in?", NOW);
    check = respond(check, "Mine.", NOW);
    check = approve(check, "ops@pasumai", NOW);

    expect(check.notes?.map((n) => `${n.by}:${n.state}`)).toEqual([
      "operations:reupload",
      "applicant:review",
      "operations:moreInfo",
      "applicant:review",
      "operations:verified",
    ]);
    expect(check.state).toBe("verified");
  });

  it("never shows the operator to the applicant's side of the trail", () => {
    const asked = askForMore(submitted(), "ops@pasumai", "Whose name?", NOW);
    const answered = respond(asked, "Mine.", NOW);
    expect(answered.notes?.at(-1)?.operator).toBeUndefined();
  });
});

describe("whose move it is", () => {
  it("has an answer for every state", () => {
    const states: CheckState[] = [
      "notStarted",
      "pending",
      "verified",
      "review",
      "moreInfo",
      "reupload",
      "failed",
    ];
    for (const state of states) {
      expect(["nobody", "applicant", "operations"]).toContain(waitingOn(state));
    }
  });

  it("puts an account that has been asked something in front of the applicant", () => {
    // Above "in progress", which reads as though the platform is still working
    // on it while in fact nothing moves until they reply.
    // A farmer needs identity and bank. One is done; the other has been sent
    // back, so nothing moves until they act.
    const checks = [
      approve(recordManual("identity", "XXXX XXXX 1234", NOW), "ops", NOW),
      askForReupload(recordManual("bank", "HDFC0001", NOW), "ops", "Blurred.", NOW),
    ];
    expect(kycState(checks, "farmer")).toBe("needsApplicant");
  });
});

describe("the evidence behind a check", () => {
  const photo = (n: number, day: number): KycDocument => ({
    path: `kyc/F-1/identity/${n}.jpg`,
    contentType: "image/jpeg",
    uploadedAt: new Date(`2026-08-${day}T10:00:00+05:30`),
  });

  it("takes photographs and PDFs, and nothing that renders as a page", () => {
    expect(isDocumentType("image/jpeg")).toBe(true);
    expect(isDocumentType("IMAGE/PNG")).toBe(true);
    expect(isDocumentType("application/pdf")).toBe(true);
    // A stored text/html would open as a page from our own signed origin.
    expect(isDocumentType("text/html")).toBe(false);
    expect(isDocumentType("image/svg+xml")).toBe(false);
  });

  it("keeps what was sent before, so a refusal can still be checked against it", () => {
    // The whole reason documents accumulate: operations who asked for a
    // clearer photograph must be able to see the blurred one they refused.
    const first = recordManual("identity", "XXXX XXXX 1234", NOW, [photo(1, 10)]);
    const second = withDocuments(first, [photo(2, 12)]);

    expect(second.documents).toHaveLength(2);
    expect(second.documents?.map((d) => d.path)).toContain("kyc/F-1/identity/1.jpg");
  });

  it("puts the newest first, because that is what is being decided on", () => {
    const check = withDocuments(recordManual("pan", "AAECK4521M", NOW, [photo(1, 10)]), [
      photo(2, 12),
    ]);
    expect(check.documents?.[0].path).toBe("kyc/F-1/identity/2.jpg");
  });

  it("stops an account sent back repeatedly from growing without limit", () => {
    let check = recordManual("bank", "HDFC0001 ••••4321", NOW);
    for (let i = 0; i < 20; i++) check = withDocuments(check, [photo(i, 10)]);
    expect(check.documents).toHaveLength(MAX_DOCUMENTS_KEPT);
  });

  it("leaves a check alone when nothing was uploaded", () => {
    const check = recordManual("bank", "HDFC0001 ••••4321", NOW);
    expect(withDocuments(check, []).documents).toBeUndefined();
  });

  it("still records a manual check with no photograph at all", () => {
    // Legacy submissions predate uploads, and an operator can still ask for one.
    expect(recordManual("gst", "33AAECK4521M1ZP", NOW).documents).toBeUndefined();
  });
});

describe("approving settles the question", () => {
  it("clears the reason it was asked about", () => {
    // A verified check still showing "send this again" is what the applicant
    // reads as their outstanding task, on a check that is finished.
    const asked = askForReupload(
      recordManual("pan", "AAECK4521M", NOW),
      "ops",
      "Blurred — send it again.",
      NOW,
    );
    expect(asked.reason).toBe("Blurred — send it again.");

    const done = approve({ ...asked, state: "review" }, "ops", NOW);
    expect(done.reason).toBeUndefined();
  });

  it("keeps the question in the trail", () => {
    // Cleared from `reason`, not from history: the record must still show that
    // it was sent back once.
    const asked = askForReupload(
      recordManual("pan", "AAECK4521M", NOW),
      "ops",
      "Blurred.",
      NOW,
    );
    const done = approve({ ...asked, state: "review" }, "ops", NOW);
    expect(done.notes?.some((n) => n.message === "Blurred.")).toBe(true);
  });
});
