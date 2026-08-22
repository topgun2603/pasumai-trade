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
    // A first submission was told two working days. A re-upload is somebody who
    // has already been turned away once and is waiting a second time, so it is
    // given longer before it shouts — chasing both at the same age would cry
    // wolf on the whole queue.
    expect(OVERDUE_HOURS.kyc).toBeLessThan(OVERDUE_HOURS.reupload);
  });

  it("flags a check once it is past its own patience, not before", () => {
    expect(isOverdue(item("a", "kyc", OVERDUE_HOURS.kyc + 1), NOW)).toBe(true);
    expect(isOverdue(item("b", "kyc", OVERDUE_HOURS.kyc - 1), NOW)).toBe(false);
  });

  it("is not overdue the moment it arrives", () => {
    expect(isOverdue(item("a", "kyc", 0), NOW)).toBe(false);
  });
});

describe("what to look at first", () => {
  it("puts overdue work above everything, however new", () => {
    const fresh = item("fresh", "kyc", 1);
    const late = item("late", "kyc", 80);
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
    const veryLate = item("very", "kyc", 200);
    const late = item("late", "kyc", 80);
    expect(inAttentionOrder([late, veryLate], NOW).map((i) => i.id)).toEqual(["very", "late"]);
  });

  it("has nothing to order when there is nothing", () => {
    expect(inAttentionOrder([], NOW)).toEqual([]);
  });
});

describe("counting", () => {
  it("reports zero for a kind with no work rather than omitting it", () => {
    // The tabs read these directly; a missing key would render "undefined".
    expect(countByKind([item("a", "kyc", 1)])).toEqual({ kyc: 1, reupload: 0 });
  });

  it("counts each kind separately", () => {
    const counts = countByKind([
      item("a", "kyc", 1),
      item("b", "kyc", 2),
      item("c", "reupload", 3),
    ]);
    expect(counts).toEqual({ kyc: 2, reupload: 1 });
  });
});
