import { describe, expect, it } from "vitest";

import type { Check } from "./kyc";
import { rupees } from "./money";
import {
  accountFlags,
  farmerJourney,
  isReady,
  nextStep,
  type AccountFlags,
} from "./readiness";
import type { Subscription } from "./subscription";

const NOW = new Date("2026-08-16T09:00:00+05:30");
const DAY = 86_400_000;

const live: Subscription = {
  planId: "farmer-grower",
  status: "active",
  startedAt: NOW,
  renewsAt: new Date(NOW.getTime() + 30 * DAY),
  reference: "PT-ABC234",
  amount: rupees(99),
  period: "monthly",
};

const cleared: Check[] = [
  { kind: "identity", method: "ekyc", state: "verified", checkedAt: NOW },
  { kind: "bank", method: "manual", state: "verified", checkedAt: NOW },
];
const submitted: Check[] = [
  { kind: "identity", method: "manual", state: "review", checkedAt: NOW },
  { kind: "bank", method: "manual", state: "review", checkedAt: NOW },
];

function flags(over: Partial<AccountFlags> = {}): AccountFlags {
  return {
    ekycDone: false,
    subscriptionDone: false,
    awaitingReview: false,
    blocked: false,
    ...over,
  };
}

describe("the two flags", () => {
  it("are both false on a brand new account", () => {
    const f = accountFlags({
      role: "farmer",
      checks: [],
      subscription: null,
      status: "pending",
      now: NOW,
    });
    expect(f).toEqual({
      ekycDone: false,
      subscriptionDone: false,
      awaitingReview: false,
      blocked: false,
    });
    expect(isReady(f)).toBe(false);
  });

  it("raise ekycDone only when every required check is verified", () => {
    const partial = accountFlags({
      role: "farmer",
      checks: [cleared[0]],
      subscription: null,
      status: "pending",
      now: NOW,
    });
    expect(partial.ekycDone).toBe(false);

    const done = accountFlags({
      role: "farmer",
      checks: cleared,
      subscription: null,
      status: "pending",
      now: NOW,
    });
    expect(done.ekycDone).toBe(true);
  });

  it("do not raise ekycDone for a submission still in the queue", () => {
    const f = accountFlags({
      role: "farmer",
      checks: submitted,
      subscription: null,
      status: "pending",
      now: NOW,
    });
    expect(f.ekycDone).toBe(false);
    // Distinguished from "not started", because the two need different words.
    expect(f.awaitingReview).toBe(true);
  });

  it("judge subscriptionDone against the clock, not the stored status", () => {
    const lapsed = { ...live, renewsAt: new Date(NOW.getTime() - DAY) };
    expect(
      accountFlags({
        role: "farmer",
        checks: cleared,
        subscription: lapsed,
        status: "verified",
        now: NOW,
      }).subscriptionDone,
    ).toBe(false);
  });

  it("raise blocked on a suspended or rejected account", () => {
    for (const status of ["suspended", "rejected"] as const) {
      const f = accountFlags({
        role: "farmer",
        checks: cleared,
        subscription: live,
        status,
        now: NOW,
      });
      expect(f.blocked).toBe(true);
      // Both other flags can be true and it is still not ready.
      expect(f.ekycDone && f.subscriptionDone).toBe(true);
      expect(isReady(f)).toBe(false);
    }
  });

  it("call an account ready only with both flags and no block", () => {
    expect(isReady(flags({ ekycDone: true, subscriptionDone: true }))).toBe(true);
    expect(isReady(flags({ ekycDone: true }))).toBe(false);
    expect(isReady(flags({ subscriptionDone: true }))).toBe(false);
  });
});

describe("the farmer journey", () => {
  it("always marks registration done — they are reading this while signed in", () => {
    expect(farmerJourney(flags())[0]).toMatchObject({ id: "register", state: "done" });
  });

  it("has exactly one current step at a time", () => {
    for (const f of [
      flags(),
      flags({ awaitingReview: true }),
      flags({ ekycDone: true }),
      flags({ ekycDone: true, subscriptionDone: true }),
    ]) {
      expect(farmerJourney(f).filter((s) => s.state === "current").length).toBeLessThanOrEqual(1);
    }
  });

  it("asks for verification first", () => {
    const step = nextStep(farmerJourney(flags()));
    expect(step?.id).toBe("verify");
    expect(step?.href).toBe("/farm/verification");
  });

  it("shows a submitted verification as waiting, not as the next thing to do", () => {
    // Telling somebody to "verify your identity" the day after they did is how
    // a submission looks lost.
    const journey = farmerJourney(flags({ awaitingReview: true }));
    expect(journey.find((s) => s.id === "verify")?.state).toBe("waiting");
    expect(nextStep(journey)?.id).toBe("subscribe");
  });

  it("lets somebody pay while their verification is in the queue", () => {
    // No reason to make them wait two days before they can subscribe, and the
    // plan is not wasted — trading opens the moment the check clears.
    expect(
      farmerJourney(flags({ awaitingReview: true })).find((s) => s.id === "subscribe")?.state,
    ).toBe("current");
  });

  it("locks subscribing before verification has even been started", () => {
    expect(farmerJourney(flags()).find((s) => s.id === "subscribe")?.state).toBe("locked");
  });

  it("moves to the plan once verification clears", () => {
    expect(nextStep(farmerJourney(flags({ ekycDone: true })))?.id).toBe("subscribe");
  });

  it("opens trading only when both flags are up", () => {
    expect(farmerJourney(flags({ ekycDone: true })).find((s) => s.id === "trade")?.state).toBe(
      "locked",
    );
    expect(
      farmerJourney(flags({ ekycDone: true, subscriptionDone: true })).find(
        (s) => s.id === "trade",
      )?.state,
    ).toBe("done");
  });

  it("finishes with nothing current", () => {
    const journey = farmerJourney(flags({ ekycDone: true, subscriptionDone: true }));
    expect(nextStep(journey)).toBeUndefined();
    expect(journey.every((s) => s.state === "done")).toBe(true);
  });

  it("marks every step blocked on a suspended account, and offers no action", () => {
    const journey = farmerJourney(flags({ ekycDone: true, subscriptionDone: true, blocked: true }));
    // Not "done" — an account on hold must not read as finished.
    expect(journey.filter((s) => s.state === "blocked").length).toBe(3);
    expect(nextStep(journey)).toBeUndefined();
  });
});
