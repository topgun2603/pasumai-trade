import { describe, expect, it } from "vitest";

import {
  DEFAULT_LADDER,
  daysLeft,
  due,
  reachable,
  stageFor,
  type Subscribed,
} from "./subscription-reminder";

const NOW = new Date("2026-08-18T12:00:00Z").getTime();
const DAY = 86_400_000;

function sub(over: Partial<Subscribed> = {}): Subscribed {
  return {
    accountId: "F-1",
    collection: "farmers",
    name: "R. Murugan",
    mobile: "9876543210",
    status: "active",
    renewsAt: new Date(NOW + 30 * DAY),
    ...over,
  };
}

describe("how long is left", () => {
  it("counts whole days", () => {
    expect(daysLeft(sub({ renewsAt: new Date(NOW + 7 * DAY) }), NOW)).toBe(7);
  });

  it("goes negative once it has lapsed", () => {
    expect(daysLeft(sub({ renewsAt: new Date(NOW - 2 * DAY) }), NOW)).toBe(-2);
  });

  it("has no answer for a plan with no end", () => {
    expect(daysLeft(sub({ renewsAt: undefined }), NOW)).toBeNull();
  });
});

describe("which rung of the ladder", () => {
  it("says nothing while it is far off", () => {
    expect(stageFor(sub({ renewsAt: new Date(NOW + 30 * DAY) }), NOW)).toBeNull();
  });

  it("picks the nearest threshold passed, not every one", () => {
    // Three days out has passed both fourteen and seven. Sending both would be
    // two messages for one fact.
    expect(stageFor(sub({ renewsAt: new Date(NOW + 3 * DAY) }), NOW)).toBe("near");
  });

  it("escalates as the date approaches", () => {
    expect(stageFor(sub({ renewsAt: new Date(NOW + 10 * DAY) }), NOW)).toBe("far");
    expect(stageFor(sub({ renewsAt: new Date(NOW + 5 * DAY) }), NOW)).toBe("near");
    expect(stageFor(sub({ renewsAt: new Date(NOW + 1 * DAY) }), NOW)).toBe("last");
    expect(stageFor(sub({ renewsAt: new Date(NOW - 3 * DAY) }), NOW)).toBe("lapsed");
  });
});

describe("who to tell today", () => {
  it("never reminds a lifetime plan", () => {
    // Somebody paid once to never be asked again. "Your plan expires soon" is
    // the most annoying message this platform could send them.
    const rows = due([sub({ lifetime: true, renewsAt: new Date(NOW + 1 * DAY) })], NOW);
    expect(rows).toEqual([]);
  });

  it("leaves a cancelled subscription alone", () => {
    const rows = due([sub({ status: "cancelled", renewsAt: new Date(NOW + 1 * DAY) })], NOW);
    expect(rows).toEqual([]);
  });

  it("sends nothing twice, however often the job runs", () => {
    const soon = sub({ renewsAt: new Date(NOW + 5 * DAY) });
    expect(due([soon], NOW)).toHaveLength(1);
    expect(due([{ ...soon, remindersSent: ["near"] }], NOW)).toHaveLength(0);
  });

  it("still sends a later stage after an earlier one", () => {
    // Reminded at fourteen days, now at one. A different fact, a new message.
    const rows = due([sub({ renewsAt: new Date(NOW + 1 * DAY), remindersSent: ["far"] })], NOW);
    expect(rows[0]?.stage).toBe("last");
  });

  it("ignores a plan with no expiry date at all", () => {
    expect(due([sub({ renewsAt: undefined })], NOW)).toEqual([]);
  });

  it("has a rung after expiry, not only before", () => {
    expect(DEFAULT_LADDER.some((plan) => plan.daysBefore < 0)).toBe(true);
    expect(due([sub({ renewsAt: new Date(NOW - 1 * DAY) })], NOW)[0]?.stage).toBe("lapsed");
  });
});

describe("which channels can actually reach them", () => {
  it("never claims a channel with no address behind it", () => {
    // Reporting "sent" for a message nobody received is worse than not sending.
    const noContact = sub({ mobile: undefined, email: undefined });
    expect(reachable(noContact, ["sms", "whatsapp", "email"])).toEqual([]);
  });

  it("always allows in-app, which needs only an account", () => {
    const noContact = sub({ mobile: undefined, email: undefined });
    expect(reachable(noContact, ["inApp", "push"])).toEqual(["inApp", "push"]);
  });

  it("offers SMS and WhatsApp once there is a number", () => {
    expect(reachable(sub(), ["sms", "whatsapp", "email"])).toEqual(["sms", "whatsapp"]);
  });

  it("honours what operations switched off", () => {
    expect(reachable(sub({ email: "a@b.in" }), ["inApp"])).toEqual(["inApp"]);
  });
});
