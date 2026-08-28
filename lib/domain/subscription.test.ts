import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/claims";
import { rupees } from "./money";
import {
  catalogueOpensBy,
  CAPABILITIES,
  CAPABILITIES_FOR_ROLE,
  CAPABILITY_LABELS,
  FREE_CAPABILITIES,
  GRACE_DAYS,
  STANDARD_TERMS,
  TERMS,
  activate,
  applyGatewayPayment,
  badgeFor,
  checkCapability,
  daysRemaining,
  describePlan,
  effectiveStatus,
  isSubscribed,
  perMonth,
  renew,
  requestSubscription,
  savingPercent,
  subscriptionReference,
  termOption,
  termsFor,
  type Subscription,
} from "./subscription";

const NOW = new Date("2026-08-15T09:00:00+05:30");
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    planId: "y1",
    status: "active",
    startedAt: NOW,
    renewsAt: at(30),
    reference: "PT-ABC234",
    amount: rupees(499),
    term: "y1",
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


describe("every capability is classified", () => {
  it("has a label, because the refusal text is built from it", () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    }
  });
});

describe("the term ladder", () => {
  it("prices exactly what was asked for", () => {
    const expected: Array<[string, number]> = [
      ["m1", 199_00],
      ["m3", 349_00],
      ["m6", 599_00],
      ["y1", 999_00],
      ["y2", 1499_00],
      ["y3", 1999_00],
      ["lifetime", 4999_00],
    ];
    for (const [term, paise] of expected) {
      expect(STANDARD_TERMS.find((t) => t.term === term)?.price.minorUnits).toBe(paise);
    }
  });

  it("gets cheaper per month the longer it runs", () => {
    const rates = STANDARD_TERMS.filter((t) => t.months !== null).map((t) => perMonth(t)!);
    for (let i = 1; i < rates.length; i++) {
      // Every rung must beat the one before, or it is a rung nobody should take.
      expect(rates[i]).toBeLessThan(rates[i - 1]);
    }
  });

  it("marks one year and lifetime as recommended, and nothing else", () => {
    expect(STANDARD_TERMS.filter((t) => t.recommended).map((t) => t.term)).toEqual([
      "y1",
      "lifetime",
    ]);
  });

  it("highlights lifetime alone", () => {
    expect(STANDARD_TERMS.filter((t) => t.highlight).map((t) => t.term)).toEqual(["lifetime"]);
  });

  it("computes the saving against the monthly price", () => {
    // ₹999 for twelve months is ₹83 a month against ₹199.
    expect(savingPercent(STANDARD_TERMS.find((t) => t.term === "y1")!)).toBe(58);
    expect(savingPercent(STANDARD_TERMS.find((t) => t.term === "m1")!)).toBe(0);
    // Lifetime has no month to divide by and is not sold on a monthly saving.
    expect(savingPercent(STANDARD_TERMS.find((t) => t.term === "lifetime")!)).toBe(0);
  });

  it("gives the same ladder to every role except franchise", () => {
    for (const role of ["farmer", "buyer", "transport", "manpower"] as const) {
      expect(termsFor(role)).toEqual(STANDARD_TERMS);
    }
  });

  it("sells operations nothing", () => {
    expect(termsFor("admin")).toEqual([]);
  });
});

describe("franchise pricing", () => {
  it("charges more for the first year than for the next", () => {
    expect(termsFor("franchise", false)[0].price.minorUnits).toBe(125_000_00);
    expect(termsFor("franchise", true)[0].price.minorUnits).toBe(99_000_00);
  });

  it("offers a franchise one term and not the ladder", () => {
    expect(termsFor("franchise").length).toBe(1);
    expect(termsFor("franchise")[0].term).toBe("y1");
    // Notably no lifetime: a franchise agreement is renewed, not bought out.
    expect(termsFor("franchise").some((t) => t.term === "lifetime")).toBe(false);
  });

  it("refuses a term the franchise ladder does not have", () => {
    expect(termOption("franchise", "m1")).toBeUndefined();
    expect(termOption("franchise", "lifetime")).toBeUndefined();
    expect(termOption("franchise", "y1")).toBeDefined();
  });
});

describe("lifetime", () => {
  const forever = sub({ term: "lifetime", status: "active", renewsAt: at(-5000) });

  it("never lapses, however stale the date on it is", () => {
    // The date is decades in the past here. It must not matter.
    expect(isSubscribed(forever, NOW)).toBe(true);
    expect(effectiveStatus(forever, NOW)).toBe("active");
  });

  it("still respects a cancellation", () => {
    expect(isSubscribed({ ...forever, status: "cancelled" }, NOW)).toBe(false);
  });

  it("grants nothing before it is paid for", () => {
    expect(isSubscribed({ ...forever, status: "requested" }, NOW)).toBe(false);
  });
});

describe("badges", () => {
  it("gives every term one", () => {
    for (const term of TERMS) {
      expect(badgeFor(term).label).toBeTruthy();
      expect(badgeFor(term).className).toBeTruthy();
    }
  });

  it("names them distinctly, so a ladder reads as a ladder", () => {
    const labels = TERMS.map((t) => badgeFor(t).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("calls the lifetime one Founder", () => {
    expect(badgeFor("lifetime").label).toBe("Founder");
  });
});

describe("buying a term", () => {
  it("runs a fixed term from payment, not from the click", () => {
    const option = STANDARD_TERMS.find((t) => t.term === "m3")!;
    const requested = requestSubscription(option, "PT-ABC234", NOW);
    expect(requested.status).toBe("requested");
    expect(isSubscribed(requested, NOW)).toBe(false);

    const paid = activate(requested, at(4));
    // Ninety days from payment, not eighty-six from the request.
    expect(daysRemaining(paid, at(4))).toBe(90);
  });

  it("marks a renewal, which is what franchise pricing turns on", () => {
    const option = termsFor("franchise", false)[0];
    const first = activate(requestSubscription(option, "PT-ABC234", NOW), NOW);
    expect(first.renewal ?? false).toBe(false);
    expect(renew(first, at(360)).renewal).toBe(true);
  });

  it("extends a renewal from the end date, so paying early loses nothing", () => {
    const current = sub({ term: "y1", renewsAt: at(10) });
    expect(daysRemaining(renew(current, NOW), NOW)).toBe(370);
  });
});

describe("naming a plan for a person", () => {
  it("uses the same words the pricing page uses", () => {
    // The console and the plan card must not describe one plan two ways.
    expect(describePlan("m6")).toMatchObject({ title: "6 months", tier: "Silver", retired: false });
    expect(describePlan("y1")).toMatchObject({ title: "1 year", tier: "Gold" });
  });

  it("names the lifetime plan by its badge", () => {
    expect(describePlan("lifetime")).toMatchObject({ title: "Lifetime", tier: "Founder" });
  });

  it("recovers words from an older plan id rather than hiding it", () => {
    // `farmer-grower` predates the ladder and still sits on live accounts.
    // Somebody on an old plan is still somebody paying.
    expect(describePlan("farmer-grower")).toMatchObject({
      title: "Farmer grower",
      retired: true,
    });
  });

  it("never shows a raw id", () => {
    for (const id of ["m1", "lifetime", "franchise-outlet", "something_odd"]) {
      expect(describePlan(id).title).not.toBe(id);
    }
  });
});

describe("what the subscription page opens with", () => {
  /*
    Bug 22. The full plan catalogue sat open under the status line, so a paying
    subscriber's own page was mostly six prices they could not use, and their
    plan and its expiry were one row above the pile.
  */
  it("keeps the catalogue shut for somebody already paying", () => {
    expect(catalogueOpensBy("active", false)).toBe(false);
    expect(catalogueOpensBy("trialing", false)).toBe(false);
  });

  it("opens it the moment they ask to upgrade", () => {
    expect(catalogueOpensBy("active", true)).toBe(true);
  });

  it("opens it for anybody without a plan", () => {
    // They came here to choose one. A button in front of the prices is a step
    // added for nothing.
    expect(catalogueOpensBy("none", false)).toBe(true);
    expect(catalogueOpensBy("requested", false)).toBe(true);
  });

  it("opens it for an expired or past-due plan", () => {
    /*
      The people most in need of the prices. Hiding them behind a button is the
      last thing that should stand between a lapsed subscriber and renewing —
      which is the same person Bug 23's SMS is trying to reach.
    */
    expect(catalogueOpensBy("expired", false)).toBe(true);
    expect(catalogueOpensBy("pastDue", false)).toBe(true);
  });
});

describe("applying a card payment that arrives twice", () => {
  /*
    A ₹199 month that granted sixty days.

    Razorpay reports one payment down two paths — the browser returning to
    `/api/subscription/verify`, and a webhook — and either can win. Both asked
    `isSubscribed` before deciding whether to activate or renew, so whichever
    ran second saw the first one's work as a subscription already running and
    extended it by another full term.
  */
  const ONE_MONTH = STANDARD_TERMS.find((t) => t.term === "m1")!;
  const BOUGHT = new Date("2026-04-01T09:00:00Z");
  const PAID = new Date("2026-04-01T09:02:00Z");

  function requested() {
    return requestSubscription(ONE_MONTH, "PT-ABC234", BOUGHT);
  }

  function days(from: Date, subscription: Subscription): number {
    return Math.round(
      (subscription.renewsAt.getTime() - from.getTime()) / 86_400_000,
    );
  }

  it("gives one term for one payment, whichever path lands first", () => {
    const first = applyGatewayPayment(requested(), "pay_1", null, PAID);
    expect(first.alreadyApplied).toBe(false);
    if (first.alreadyApplied) return;

    expect(first.next.status).toBe("active");
    expect(days(PAID, first.next)).toBe(30);

    // The other path, moments later, reporting the same payment.
    const second = applyGatewayPayment(first.next, "pay_1", "pay_1", PAID);
    expect(second.alreadyApplied).toBe(true);
  });

  /*
    The half that must not be lost. Somebody buying a second term before the
    first runs out keeps the days they have already paid for.
  */
  it("still extends for a genuinely different payment", () => {
    const first = applyGatewayPayment(requested(), "pay_1", null, PAID);
    if (first.alreadyApplied) throw new Error("unreachable");

    const second = applyGatewayPayment(first.next, "pay_2", "pay_1", PAID);
    expect(second.alreadyApplied).toBe(false);
    if (second.alreadyApplied) return;

    expect(days(PAID, second.next)).toBe(60);
    expect(second.next.renewal).toBe(true);
  });

  /*
    Both halves of the guard are load-bearing. A payment id sitting on a record
    that never went active is a payment that was seen and not applied — usually
    one that failed — and refusing to activate it would leave somebody who has
    paid with nothing.
  */
  it("applies a payment whose id was recorded but never activated anything", () => {
    const seen = { ...requested(), status: "requested" as const };
    const result = applyGatewayPayment(seen, "pay_1", "pay_1", PAID);
    expect(result.alreadyApplied).toBe(false);
  });
});
