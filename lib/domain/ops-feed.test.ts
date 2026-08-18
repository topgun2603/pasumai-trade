import { describe, expect, it } from "vitest";

import {
  countByKind,
  inAttentionOrder,
  isOverdue,
  OVERDUE_HOURS,
  type OpsItem,
} from "./ops-feed";

const NOW = new Date("2026-08-18T12:00:00+05:30").getTime();
const HOUR = 3_600_000;

function item(id: string, kind: OpsItem["kind"], hoursAgo: number): OpsItem {
  return {
    id,
    kind,
    title: id,
    detail: "",
    since: NOW - hoursAgo * HOUR,
    href: "/admin",
  };
}

describe("how long is too long", () => {
  it("gives each kind of work its own patience", () => {
    // Somebody expecting a telephone call counts in hours; a KYC submission was
    // told two working days, and flagging it sooner would cry wolf on the whole
    // queue.
    expect(OVERDUE_HOURS.enquiry).toBeLessThan(OVERDUE_HOURS.kyc);
    expect(OVERDUE_HOURS.kyc).toBeLessThan(OVERDUE_HOURS.reupload);
  });

  it("flags an enquiry after a day but a check of the same age not at all", () => {
    expect(isOverdue(item("a", "enquiry", 25), NOW)).toBe(true);
    expect(isOverdue(item("b", "kyc", 25), NOW)).toBe(false);
  });

  it("is not overdue the moment it arrives", () => {
    expect(isOverdue(item("a", "enquiry", 0), NOW)).toBe(false);
  });
});

describe("what to look at first", () => {
  it("puts overdue work above everything, however new", () => {
    const fresh = item("fresh", "kyc", 1);
    const late = item("late", "enquiry", 40);
    expect(inAttentionOrder([fresh, late], NOW).map((i) => i.id)).toEqual(["late", "fresh"]);
  });

  it("orders the rest oldest first", () => {
    // A feed sorted newest-first buries the person who has waited longest under
    // the people who have waited least, which is backwards for work.
    const older = item("older", "kyc", 10);
    const newer = item("newer", "kyc", 2);
    expect(inAttentionOrder([newer, older], NOW).map((i) => i.id)).toEqual(["older", "newer"]);
  });

  it("orders overdue work oldest first too", () => {
    const veryLate = item("very", "enquiry", 100);
    const late = item("late", "enquiry", 30);
    expect(inAttentionOrder([late, veryLate], NOW).map((i) => i.id)).toEqual(["very", "late"]);
  });

  it("has nothing to order when there is nothing", () => {
    expect(inAttentionOrder([], NOW)).toEqual([]);
  });
});

describe("counting", () => {
  it("reports zero for a kind with no work rather than omitting it", () => {
    // The tabs read these directly; a missing key would render "undefined".
    expect(countByKind([item("a", "kyc", 1)])).toEqual({ enquiry: 0, kyc: 1, reupload: 0 });
  });

  it("counts each kind separately", () => {
    const counts = countByKind([
      item("a", "enquiry", 1),
      item("b", "enquiry", 2),
      item("c", "reupload", 3),
    ]);
    expect(counts).toEqual({ enquiry: 2, kyc: 0, reupload: 1 });
  });
});
