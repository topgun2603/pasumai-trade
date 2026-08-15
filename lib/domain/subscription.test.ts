import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/claims";
import { rupees } from "./money";
import {
  activate,
  CAPABILITIES,
  CAPABILITIES_FOR_ROLE,
  CAPABILITY_LABELS,
  checkCapability,
  daysRemaining,
  DEFAULT_PLANS,
  effectiveStatus,
  FREE_CAPABILITIES,
  GRACE_DAYS,
  isSubscribed,
  planById,
  plansForRole,
  priceFor,
  renew,
  requestSubscription,
  subscriptionReference,
  yearlySaving,
  type Subscription,
} from "./subscription";

const NOW = new Date("2026-08-15T09:00:00+05:30");
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    planId: "buyer-trade",
    status: "active",
    startedAt: NOW,
    renewsAt: at(30),
    reference: "PT-ABC234",
    amount: rupees(499),
    period: "monthly",
    ...over,
  };
}

describe("what is free", () => {
  it("is browsing, and only browsing", () => {
    expect([...FREE_CAPABILITIES]).toEqual(["browse"]);
  });

  it("lets anyone browse with no subscription at all", () => {
    for (const role of ROLES) {
      expect(
        checkCapability("browse", { role, subscription: null, now: NOW }).allowed,
      ).toBe(true);
    }
  });

  it("lets a suspended, expired account still browse", () => {
    expect(
      checkCapability("browse", {
        role: "buyer",
        subscription: sub({ status: "expired" }),
        blocked: true,
        now: NOW,
      }).allowed,
    ).toBe(true);
  });

  // The safe direction to be wrong in: a capability nobody classified is paid.
  it("charges for every capability that is not explicitly free", () => {
    const paid = CAPABILITIES.filter((c) => !FREE_CAPABILITIES.includes(c));
    for (const capability of paid) {
      const result = checkCapability(capability, {
        role: "buyer",
        subscription: null,
        now: NOW,
      });
      // Only the ones a buyer could use at all; the rest refuse for role.
      if (CAPABILITIES_FOR_ROLE.buyer.includes(capability)) {
        expect(result).toMatchObject({ allowed: false, code: "needsSubscription" });
      }
    }
    expect(paid.length).toBeGreaterThan(0);
  });
});

describe("the gate", () => {
  it("refuses a capability the role never has, before asking about money", () => {
    expect(
      checkCapability("postListing", { role: "buyer", subscription: sub(), now: NOW }),
    ).toMatchObject({ allowed: false, code: "notForRole" });
  });

  it("refuses a blocked account before offering it a plan", () => {
    const result = checkCapability("bargain", {
      role: "farmer",
      subscription: null,
      blocked: true,
      now: NOW,
    });
    // Not `needsSubscription` — selling a plan to an account that a person
    // suspended would be taking money for nothing.
    expect(result).toMatchObject({ allowed: false, code: "accountBlocked" });
  });

  it("never charges operations", () => {
    for (const capability of CAPABILITIES) {
      expect(
        checkCapability(capability, { role: "admin", subscription: null, now: NOW })
          .allowed,
      ).toBe(true);
    }
  });

  it("allows a paid capability once subscribed", () => {
    expect(
      checkCapability("order", { role: "buyer", subscription: sub(), now: NOW }).allowed,
    ).toBe(true);
  });

  it("says renew, not subscribe, when it has lapsed", () => {
    const result = checkCapability("order", {
      role: "buyer",
      subscription: sub({ renewsAt: at(-40) }),
      now: NOW,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/expired/i);
  });

  it("tells a requested subscription it is waiting on payment", () => {
    const result = checkCapability("order", {
      role: "buyer",
      subscription: sub({ status: "requested" }),
      now: NOW,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/payment/i);
  });

  it("covers every role", () => {
    for (const role of ROLES) {
      expect(CAPABILITIES_FOR_ROLE[role].length).toBeGreaterThan(0);
      expect(CAPABILITIES_FOR_ROLE[role]).toContain("browse");
    }
  });
});

describe("the clock, not just the status", () => {
  it("refuses an active record whose period has ended", () => {
    // The case that matters: nothing rewrote the record, so status still says
    // active. Reading status alone would keep a lapsed account trading.
    expect(isSubscribed(sub({ renewsAt: at(-1) }), NOW)).toBe(false);
  });

  it("grants a requested subscription nothing", () => {
    expect(isSubscribed(sub({ status: "requested" }), NOW)).toBe(false);
  });

  it("grants nothing when there is no subscription", () => {
    expect(isSubscribed(null, NOW)).toBe(false);
    expect(isSubscribed(undefined, NOW)).toBe(false);
  });

  it("keeps a past-due subscription working through the grace window", () => {
    const lapsed = sub({ status: "pastDue", renewsAt: at(-3) });
    expect(isSubscribed(lapsed, NOW)).toBe(true);
    expect(isSubscribed(sub({ status: "pastDue", renewsAt: at(-GRACE_DAYS - 1) }), NOW)).toBe(
      false,
    );
  });

  it("reports lapsed as pastDue then expired without anything rewriting it", () => {
    expect(effectiveStatus(sub({ renewsAt: at(-2) }), NOW)).toBe("pastDue");
    expect(effectiveStatus(sub({ renewsAt: at(-GRACE_DAYS - 2) }), NOW)).toBe("expired");
    expect(effectiveStatus(sub(), NOW)).toBe("active");
    expect(effectiveStatus(null, NOW)).toBe("none");
  });

  it("counts days left", () => {
    expect(daysRemaining(sub({ renewsAt: at(10) }), NOW)).toBe(10);
  });
});

describe("starting and paying", () => {
  const plan = planById("buyer-trade")!;

  it("creates a request that grants nothing", () => {
    const requested = requestSubscription(plan, "monthly", "PT-ABC234", NOW);
    expect(requested.status).toBe("requested");
    expect(isSubscribed(requested, NOW)).toBe(false);
    expect(requested.paidAt).toBeUndefined();
  });

  it("runs the paid period from payment, not from the click", () => {
    const requested = requestSubscription(plan, "monthly", "PT-ABC234", NOW);
    const paid = activate(requested, at(4));
    // Four days waiting on a bank transfer are not deducted from the month.
    expect(daysRemaining(paid, at(4))).toBe(30);
    expect(isSubscribed(paid, at(4))).toBe(true);
  });

  it("extends a renewal from the end date, so paying early loses nothing", () => {
    const current = sub({ renewsAt: at(10) });
    const renewed = renew(current, NOW);
    expect(daysRemaining(renewed, NOW)).toBe(40);
  });

  it("renews from today when it already lapsed", () => {
    const renewed = renew(sub({ renewsAt: at(-10) }), NOW);
    expect(daysRemaining(renewed, NOW)).toBe(30);
  });

  it("charges a year for a yearly plan", () => {
    const yearly = requestSubscription(plan, "yearly", "PT-ABC234", NOW);
    expect(yearly.amount).toEqual(plan.yearly);
    expect(daysRemaining(yearly, NOW)).toBe(365);
  });
});

describe("payment references", () => {
  it("never contains a character that is misread down a phone line", () => {
    for (let i = 0; i < 200; i++) {
      const reference = subscriptionReference(`seed-${i}-${i * 7}`);
      expect(reference.startsWith("PT-")).toBe(true);
      expect(reference.slice(3)).not.toMatch(/[IO01]/);
      expect(reference).toHaveLength(9);
    }
  });
});

describe("plans", () => {
  it("gives every self-registering role something to buy", () => {
    for (const role of ROLES) {
      if (role === "admin") continue;
      expect(plansForRole(role).length).toBeGreaterThan(0);
    }
  });

  it("sells operations nothing", () => {
    expect(plansForRole("admin")).toEqual([]);
  });

  it("makes a year cheaper than twelve months, or there is no reason to pick it", () => {
    for (const plan of DEFAULT_PLANS) {
      expect(plan.yearly.minorUnits).toBeLessThan(plan.monthly.minorUnits * 12);
      expect(yearlySaving(plan)).toBeGreaterThan(0);
    }
  });

  it("prices in whole paise, in rupees", () => {
    for (const plan of DEFAULT_PLANS) {
      expect(Number.isInteger(plan.monthly.minorUnits)).toBe(true);
      expect(plan.monthly.currency).toBe("INR");
    }
  });

  it("picks the period asked for", () => {
    const plan = DEFAULT_PLANS[0];
    expect(priceFor(plan, "monthly")).toEqual(plan.monthly);
    expect(priceFor(plan, "yearly")).toEqual(plan.yearly);
  });

  it("has unique ids", () => {
    const ids = DEFAULT_PLANS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("every capability is classified", () => {
  it("has a label, because the refusal text is built from it", () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    }
  });
});
