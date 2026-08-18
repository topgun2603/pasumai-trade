import { describe, expect, it } from "vitest";

import {
  advance,
  EnquiryError,
  inWorkingOrder,
  isWaiting,
  normaliseMobile,
  validate,
  type Enquiry,
  type EnquiryDraft,
} from "./enquiry";

const NOW = new Date("2026-08-18T10:00:00+05:30");

function draft(over: Partial<EnquiryDraft> = {}): EnquiryDraft {
  return {
    interest: "buyer",
    name: "R. Murugan",
    organisation: "",
    mobile: "9876543210",
    district: "Erode",
    message: "",
    locale: "ta",
    ...over,
  };
}

function enquiry(over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: "E-1",
    interest: "buyer",
    name: "R. Murugan",
    mobile: "9876543210",
    district: "Erode",
    status: "new",
    createdAt: NOW,
    ...over,
  };
}

describe("what may be submitted", () => {
  it("accepts an ordinary enquiry", () => {
    expect(validate(draft())).toEqual({});
  });

  it("insists on the three things needed to make the call", () => {
    const errors = validate(draft({ name: "  ", mobile: "", district: "" }));
    expect(Object.keys(errors).sort()).toEqual(["district", "mobile", "name"]);
  });

  it("takes a number however it was typed", () => {
    for (const mobile of ["9876543210", "+91 98765 43210", "919876543210", "98765-43210"]) {
      expect(validate(draft({ mobile })), mobile).toEqual({});
    }
  });

  it("refuses a number nobody can ring", () => {
    // Indian mobiles start 6-9. A landline or a short number is an enquiry that
    // cannot be answered, which is not an enquiry.
    for (const mobile of ["1234567890", "98765", "5876543210", "abcdefghij"]) {
      expect(validate(draft({ mobile })).mobile, mobile).toBeTruthy();
    }
  });

  it("caps the message rather than taking a payload", () => {
    expect(validate(draft({ message: "x".repeat(601) })).message).toBeTruthy();
    expect(validate(draft({ message: "x".repeat(600) })).message).toBeUndefined();
  });

  it("stores one shape of number whatever was typed", () => {
    expect(normaliseMobile("+91 98765 43210")).toBe("9876543210");
    expect(normaliseMobile("9876543210")).toBe("9876543210");
  });
});

describe("working through the queue", () => {
  it("counts only the ones nobody has called", () => {
    expect(isWaiting("new")).toBe(true);
    expect(["contacted", "converted", "closed"].some((s) => isWaiting(s as never))).toBe(false);
  });

  it("puts new enquiries first, oldest of those first", () => {
    const older = enquiry({ id: "old", createdAt: new Date("2026-08-01T10:00:00Z") });
    const newer = enquiry({ id: "new", createdAt: new Date("2026-08-17T10:00:00Z") });
    const done = enquiry({ id: "done", status: "converted", createdAt: new Date("2026-07-01T10:00:00Z") });

    expect(inWorkingOrder([done, newer, older]).map((e) => e.id)).toEqual([
      "old",
      "new",
      "done",
    ]);
  });

  it("records who moved it and when", () => {
    const moved = advance(enquiry(), "contacted", "ops@srirealtime.com", "Rang, will call back", NOW);
    expect(moved.status).toBe("contacted");
    expect(moved.notes).toHaveLength(1);
    expect(moved.notes?.[0].operator).toBe("ops@srirealtime.com");
  });

  it("keeps the trail across several moves", () => {
    const first = advance(enquiry(), "contacted", "ops", "Rang", NOW);
    const second = advance(first, "converted", "ops", undefined, NOW);
    expect(second.notes).toHaveLength(2);
  });

  it("demands a reason before closing", () => {
    // "Closed" on its own tells the next operator nothing, which is how the
    // same person gets telephoned twice.
    expect(() => advance(enquiry(), "closed", "ops", "  ", NOW)).toThrow(EnquiryError);
    expect(() => advance(enquiry(), "closed", "ops", "Wrong number", NOW)).not.toThrow();
  });

  it("refuses to put work back on the badge", () => {
    const contacted = enquiry({ status: "contacted" });
    expect(() => advance(contacted, "new", "ops", undefined, NOW)).toThrow(EnquiryError);
  });

  it("refuses to move it where it already is", () => {
    expect(() => advance(enquiry(), "new", "ops", undefined, NOW)).toThrow(EnquiryError);
  });
});
