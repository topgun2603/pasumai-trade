import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_LABELS,
  auditKey,
  matches,
  mayReadAudit,
  newestFirst,
  type AuditEntry,
} from "./audit";

const AT = new Date("2026-08-23T10:15:30+05:30");

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: "x",
    action: "listing.quantityChanged",
    actor: { accountId: "F-3E4ADB", role: "farmer", name: "R. Selvam" },
    subject: { kind: "listings", id: "L-42" },
    from: "500 kg",
    to: "300 kg",
    at: AT,
    ...over,
  };
}

describe("the audit key", () => {
  /*
    Bug 13 asked for an immutable log. A derived id is half of what makes it
    one: a retried cron, a double-submitted form or an operator pressing a
    button twice would otherwise append the same change three times, and a
    history showing one edit as three is worse than none — somebody will
    read it as three edits.
  */
  it("is the same for the same event", () => {
    expect(auditKey(entry())).toBe(auditKey(entry()));
  });

  it("differs when the value changed differs", () => {
    expect(auditKey(entry())).not.toBe(auditKey(entry({ action: "listing.priceChanged" })));
  });

  it("differs per subject, so two listings never collide", () => {
    expect(auditKey(entry())).not.toBe(
      auditKey(entry({ subject: { kind: "listings", id: "L-43" } })),
    );
  });

  it("treats a second later as a separate edit", () => {
    // Twice in one second is a duplicate write. A minute later is a real
    // second edit, and collapsing those would lose history.
    const later = new Date(AT.getTime() + 1000);
    expect(auditKey(entry({ at: later }))).not.toBe(auditKey(entry()));
  });

  it("collapses two writes inside the same second", () => {
    const sameSecond = new Date(AT.getTime() + 400);
    expect(auditKey(entry({ at: sameSecond }))).toBe(auditKey(entry()));
  });

  it("keys operations by their role, having no account", () => {
    const ops = entry({ actor: { role: "admin", name: "Operations" } });
    expect(auditKey(ops)).toContain("admin");
  });
});

describe("who may read an entry", () => {
  it("shows operations everything", () => {
    expect(mayReadAudit(entry(), { role: "admin" })).toBe(true);
  });

  it("shows you your own actions", () => {
    expect(mayReadAudit(entry(), { role: "farmer", accountId: "F-3E4ADB" })).toBe(true);
  });

  it("shows you what was done to your record by somebody else", () => {
    /*
      The important half. A farmer needs to see that operations changed their
      listing's quantity — which is not an action they took, and a log that
      only shows your own actions would hide exactly the change worth auditing.
    */
    const byOps = entry({
      actor: { role: "admin", name: "Operations" },
      subject: { kind: "farmers", id: "F-3E4ADB" },
    });
    expect(mayReadAudit(byOps, { role: "farmer", accountId: "F-3E4ADB" })).toBe(true);
  });

  it("shows you nothing of somebody else's", () => {
    expect(mayReadAudit(entry(), { role: "farmer", accountId: "F-OTHER" })).toBe(false);
    expect(mayReadAudit(entry(), { role: "buyer", accountId: "B-1" })).toBe(false);
  });

  it("shows nothing to a session with no account", () => {
    expect(mayReadAudit(entry(), { role: "farmer" })).toBe(false);
  });
});

describe("filtering a history", () => {
  const rows = [
    entry({ id: "1", at: new Date("2026-08-01T09:00:00+05:30") }),
    entry({ id: "2", action: "listing.priceChanged", at: new Date("2026-08-10T09:00:00+05:30") }),
    entry({
      id: "3",
      actor: { accountId: "B-1", role: "buyer", name: "Kongu Fresh" },
      at: new Date("2026-08-20T09:00:00+05:30"),
    }),
  ];

  it("filters by action", () => {
    expect(rows.filter((r) => matches(r, { action: "listing.priceChanged" })).map((r) => r.id)).toEqual(["2"]);
  });

  it("filters by who did it", () => {
    expect(rows.filter((r) => matches(r, { actorId: "B-1" })).map((r) => r.id)).toEqual(["3"]);
  });

  it("filters by date range, inclusive at both ends", () => {
    const kept = rows.filter((r) =>
      matches(r, {
        since: new Date("2026-08-10T09:00:00+05:30"),
        until: new Date("2026-08-20T09:00:00+05:30"),
      }),
    );
    expect(kept.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("combines filters", () => {
    expect(
      rows.filter((r) => matches(r, { actorId: "F-3E4ADB", action: "listing.priceChanged" })).map((r) => r.id),
    ).toEqual(["2"]);
  });

  it("keeps everything when nothing is asked", () => {
    expect(rows.filter((r) => matches(r, {})).length).toBe(3);
  });
});

describe("ordering", () => {
  it("puts the newest first and does not mutate the input", () => {
    const rows = [
      entry({ id: "old", at: new Date("2026-08-01T09:00:00+05:30") }),
      entry({ id: "new", at: new Date("2026-08-20T09:00:00+05:30") }),
    ];
    expect(newestFirst(rows).map((r) => r.id)).toEqual(["new", "old"]);
    expect(rows.map((r) => r.id)).toEqual(["old", "new"]);
  });
});

describe("what is actually wired", () => {
  /*
    A declared action that nothing writes is a promise the log does not keep.
    Nine of the eleven are hooked into a real endpoint and proven against a
    running server; these two are not, because orders have no write path yet —
    they come from `lib/mock/orders.ts` and there is nothing to place or
    cancel.

    Pinned so the gap stays visible. When an orders endpoint lands, this list
    shrinks, and if it does not the failure says so.
  */
  const NOT_YET_WIRED = ["order.placed", "order.cancelled"];

  it("names the actions still waiting on an endpoint", () => {
    expect(NOT_YET_WIRED.every((action) => AUDIT_ACTIONS.includes(action as never))).toBe(true);
  });

  it("has a label for every action, wired or not", () => {
    // A row that reaches a history page with no label renders blank, and the
    // one nobody has written yet is the one nobody notices is missing.
    for (const action of AUDIT_ACTIONS) {
      expect(AUDIT_LABELS[action], action).toBeTruthy();
    }
  });
});
