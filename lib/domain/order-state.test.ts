import { describe, expect, it } from "vitest";

import { rupees } from "./money";
import type { Subscription } from "./subscription";

import type {
  BuyerAccount,
  ComplianceDocument,
  DriverAccount,
  Vehicle,
} from "./admin";
import type { OrderStatus } from "./enums";
import { money } from "./money";
import {
  assertProcurement,
  BUYER_ORDER_TERMINAL,
  BUYER_ORDER_TRANSITIONS,
  buyerMayOrder,
  canAdvanceBuyerOrder,
  canAdvanceProcurement,
  driverDispatchable,
  nextProcurementStates,
  PROCUREMENT_TERMINAL,
  PROCUREMENT_TRANSITIONS,
  TransitionError,
  vehicleDispatchable,
  type BuyerOrderStatus,
  type TransitionContext,
} from "./order-state";

const NOW = Date.UTC(2026, 7, 13);
const DAY = 86_400_000;

function doc(
  kind: ComplianceDocument["kind"],
  daysUntilExpiry: number | null,
): ComplianceDocument {
  return {
    kind,
    reference: `${kind}-ref`,
    expiresAt:
      daysUntilExpiry === null ? undefined : new Date(NOW + daysUntilExpiry * DAY),
    verifiedAt: new Date(NOW - 30 * DAY),
  };
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "V-1",
    agencyId: "AG-102",
    registration: "TN 20 BA 4471",
    type: "miniTruck",
    capacityKg: 1500,
    owner: "Kongu Agri Traders",
    district: "Krishnagiri",
    status: "verified",
    registeredAt: new Date(NOW - 300 * DAY),
    refrigerated: false,
    documents: [doc("rc", null), doc("insurance", 190), doc("fitness", 240), doc("permit", 300)],
    ...overrides,
  };
}

function driver(overrides: Partial<DriverAccount> = {}): DriverAccount {
  return {
    id: "D-1",
    agencyId: "AG-102",
    name: "S. Mani",
    mobile: "+91 98404 22190",
    district: "Krishnagiri",
    status: "verified",
    registeredAt: new Date(NOW - 300 * DAY),
    tripsCompleted: 412,
    documents: [doc("drivingLicence", 480), doc("aadhaar", null)],
    ...overrides,
  };
}

function buyer(overrides: Partial<BuyerAccount> = {}): BuyerAccount {
  return {
    id: "B-1",
    name: "Kongu Agri Traders",
    kind: "franchise",
    contactName: "V. Senthil",
    mobile: "+91 98430 11204",
    town: "Hosur",
    district: "Krishnagiri",
    districts: ["Krishnagiri"],
    status: "verified",
    registeredAt: new Date(NOW - 400 * DAY),
    ordersPlaced: 486,
    lifetimeValue: money(0),
    documents: [doc("gst", null)],
    ...overrides,
  };
}

const base: TransitionContext = { now: NOW };

const dispatchable: TransitionContext = {
  now: NOW,
  vehicle: vehicle(),
  driver: driver(),
};

describe("vehicleDispatchable", () => {
  it("allows a verified vehicle with everything in date", () => {
    expect(vehicleDispatchable(vehicle(), NOW).allowed).toBe(true);
  });

  it("refuses when insurance has lapsed", () => {
    const result = vehicleDispatchable(
      vehicle({
        documents: [doc("rc", null), doc("insurance", -9), doc("fitness", 240)],
      }),
      NOW,
    );
    expect(result).toMatchObject({
      allowed: false,
      refusal: { code: "vehicleNotDispatchable" },
    });
    expect(result.allowed === false && result.refusal.message).toContain("uninsured");
  });

  it("refuses when any single certificate has lapsed, not just insurance", () => {
    const result = vehicleDispatchable(
      vehicle({
        documents: [doc("rc", null), doc("insurance", 190), doc("fitness", -1)],
      }),
      NOW,
    );
    expect(result.allowed).toBe(false);
  });

  it("refuses a suspended vehicle even with valid documents", () => {
    expect(vehicleDispatchable(vehicle({ status: "suspended" }), NOW)).toMatchObject({
      allowed: false,
      refusal: { code: "vehicleNotDispatchable" },
    });
  });

  it("refuses a vehicle with no documents at all", () => {
    expect(vehicleDispatchable(vehicle({ documents: [] }), NOW).allowed).toBe(false);
  });

  it("allows a certificate expiring today but refuses one that expired yesterday", () => {
    expect(
      vehicleDispatchable(
        vehicle({ documents: [doc("rc", null), doc("insurance", 1)] }),
        NOW,
      ).allowed,
    ).toBe(true);
    expect(
      vehicleDispatchable(
        vehicle({ documents: [doc("rc", null), doc("insurance", -1)] }),
        NOW,
      ).allowed,
    ).toBe(false);
  });
});

describe("driverDispatchable", () => {
  it("allows a verified driver with a current licence", () => {
    expect(driverDispatchable(driver(), NOW).allowed).toBe(true);
  });

  it("refuses an expired licence", () => {
    expect(
      driverDispatchable(
        driver({ documents: [doc("drivingLicence", -6), doc("aadhaar", null)] }),
        NOW,
      ),
    ).toMatchObject({ allowed: false, refusal: { code: "driverNotDispatchable" } });
  });

  it("refuses when no licence is on file", () => {
    expect(
      driverDispatchable(driver({ documents: [doc("aadhaar", null)] }), NOW).allowed,
    ).toBe(false);
  });

  it("refuses a pending driver", () => {
    expect(driverDispatchable(driver({ status: "pending" }), NOW).allowed).toBe(false);
  });
});

describe("buyerMayOrder", () => {
  const CLOCK = new Date(NOW);
  const live: Subscription = {
    planId: "y1",
    status: "active",
    startedAt: new Date(NOW - 86_400_000),
    renewsAt: new Date(NOW + 30 * 86_400_000),
    reference: "PT-ABC234",
    amount: rupees(499),
    term: "y1",
  };

  it("allows a subscribed account", () => {
    expect(buyerMayOrder(buyer(), live, CLOCK).allowed).toBe(true);
  });

  it("refuses an account with no subscription", () => {
    expect(buyerMayOrder(buyer(), null, CLOCK)).toMatchObject({
      allowed: false,
      refusal: { code: "buyerNotSubscribed" },
    });
  });

  it("refuses a subscription whose period has run out", () => {
    expect(
      buyerMayOrder(buyer(), { ...live, renewsAt: new Date(NOW - 60 * 86_400_000) }, CLOCK),
    ).toMatchObject({ allowed: false, refusal: { code: "buyerNotSubscribed" } });
  });

  // Verification no longer gates ordering — a pending account is one nobody has
  // reviewed yet, and making it wait was the thing that stopped anyone
  // registering and getting started the same day.
  it("allows a subscribed account that is still pending review", () => {
    expect(buyerMayOrder(buyer({ status: "pending" }), live, CLOCK).allowed).toBe(true);
  });

  // A refusal by a person is not something a subscription buys past.
  it.each(["suspended", "rejected"] as const)("refuses a %s account", (status) => {
    expect(buyerMayOrder(buyer({ status }), live, CLOCK)).toMatchObject({
      allowed: false,
      refusal: { code: "buyerBlocked" },
    });
  });
});

describe("procurement lifecycle", () => {
  it("walks the whole happy path", () => {
    const steps: Array<[OrderStatus, OrderStatus, Parameters<typeof canAdvanceProcurement>[2], TransitionContext]> = [
      ["confirmed", "ready", "farmer", base],
      ["ready", "driverAssigned", "platform", dispatchable],
      ["driverAssigned", "atPickup", "driver", base],
      ["atPickup", "graded", "driver", { ...base, handoverCode: "4471", providedCode: "4471" }],
      ["graded", "inTransit", "farmer", base],
      ["inTransit", "delivered", "buyer", base],
      ["delivered", "paid", "platform", base],
    ];

    for (const [from, to, actor, context] of steps) {
      expect(
        canAdvanceProcurement(from, to, actor, context),
        `${from} → ${to} as ${actor}`,
      ).toEqual({ allowed: true });
    }
  });

  it("refuses a skipped step", () => {
    expect(canAdvanceProcurement("confirmed", "inTransit", "platform", base)).toMatchObject({
      allowed: false,
      refusal: { code: "wrongState" },
    });
  });

  it("refuses moving backwards", () => {
    expect(canAdvanceProcurement("delivered", "inTransit", "platform", base)).toMatchObject({
      allowed: false,
      refusal: { code: "wrongState" },
    });
  });

  it("refuses the wrong actor", () => {
    // A driver cannot decide the produce is ready — only the farmer can.
    expect(canAdvanceProcurement("confirmed", "ready", "driver", base)).toMatchObject({
      allowed: false,
      refusal: { code: "notPermitted" },
    });
  });

  it.each(PROCUREMENT_TERMINAL)("treats %s as terminal", (status) => {
    expect(nextProcurementStates(status)).toEqual([]);
    expect(canAdvanceProcurement(status, "ready", "platform", base)).toMatchObject({
      allowed: false,
      refusal: { code: "terminal" },
    });
  });

  it("cannot be cancelled once delivered", () => {
    expect(canAdvanceProcurement("delivered", "cancelled", "platform", base)).toMatchObject({
      allowed: false,
      refusal: { code: "wrongState" },
    });
  });

  it.each(["confirmed", "ready", "driverAssigned", "atPickup", "graded"] as const)(
    "can be cancelled from %s",
    (from) => {
      expect(canAdvanceProcurement(from, "cancelled", "platform", base).allowed).toBe(true);
    },
  );

  describe("dispatch guards", () => {
    it("blocks assignment when the vehicle has expired insurance", () => {
      const result = canAdvanceProcurement("ready", "driverAssigned", "platform", {
        now: NOW,
        vehicle: vehicle({
          documents: [doc("rc", null), doc("insurance", -9)],
        }),
        driver: driver(),
      });
      expect(result).toMatchObject({
        allowed: false,
        refusal: { code: "vehicleNotDispatchable" },
      });
    });

    it("blocks assignment when the driver's licence has expired", () => {
      expect(
        canAdvanceProcurement("ready", "driverAssigned", "platform", {
          now: NOW,
          vehicle: vehicle(),
          driver: driver({ documents: [doc("drivingLicence", -6)] }),
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "driverNotDispatchable" } });
    });

    it("fails closed when no vehicle is supplied", () => {
      expect(
        canAdvanceProcurement("ready", "driverAssigned", "platform", {
          now: NOW,
          driver: driver(),
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "missingContext" } });
    });

    it("fails closed when no driver is supplied", () => {
      expect(
        canAdvanceProcurement("ready", "driverAssigned", "platform", {
          now: NOW,
          vehicle: vehicle(),
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "missingContext" } });
    });
  });

  describe("handover code", () => {
    it("accepts the matching code", () => {
      expect(
        canAdvanceProcurement("atPickup", "graded", "driver", {
          ...base,
          handoverCode: "4471",
          providedCode: "4471",
        }).allowed,
      ).toBe(true);
    });

    it("rejects a wrong code", () => {
      expect(
        canAdvanceProcurement("atPickup", "graded", "driver", {
          ...base,
          handoverCode: "4471",
          providedCode: "4470",
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "handoverCodeMismatch" } });
    });

    it("preserves leading zeros — codes are strings, not numbers", () => {
      expect(
        canAdvanceProcurement("atPickup", "graded", "driver", {
          ...base,
          handoverCode: "0471",
          providedCode: "471",
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "handoverCodeMismatch" } });
    });

    it("fails closed when no code is supplied", () => {
      expect(canAdvanceProcurement("atPickup", "graded", "driver", base)).toMatchObject({
        allowed: false,
        refusal: { code: "missingContext" },
      });
    });
  });

  describe("grade dispute", () => {
    it("holds the load while a grade is disputed", () => {
      expect(
        canAdvanceProcurement("graded", "inTransit", "farmer", {
          ...base,
          gradeDisputed: true,
        }),
      ).toMatchObject({ allowed: false, refusal: { code: "gradeDisputed" } });
    });

    it("releases once the dispute is resolved", () => {
      expect(
        canAdvanceProcurement("graded", "inTransit", "farmer", {
          ...base,
          gradeDisputed: false,
        }).allowed,
      ).toBe(true);
    });

    it("still permits cancellation while disputed", () => {
      expect(
        canAdvanceProcurement("graded", "cancelled", "platform", {
          ...base,
          gradeDisputed: true,
        }).allowed,
      ).toBe(true);
    });
  });
});

describe("buyer order lifecycle", () => {
  it("walks the happy path", () => {
    const steps: Array<[BuyerOrderStatus, BuyerOrderStatus, Parameters<typeof canAdvanceBuyerOrder>[2], TransitionContext]> = [
      ["pendingPayment", "paid", "system", { ...base, paymentCaptured: true }],
      ["paid", "allocated", "platform", dispatchable],
      ["allocated", "inTransit", "driver", base],
      ["inTransit", "delivered", "buyer", base],
      ["delivered", "completed", "platform", base],
    ];

    for (const [from, to, actor, context] of steps) {
      expect(
        canAdvanceBuyerOrder(from, to, actor, context),
        `${from} → ${to} as ${actor}`,
      ).toEqual({ allowed: true });
    }
  });

  it("will not mark an order paid without confirmed capture", () => {
    expect(
      canAdvanceBuyerOrder("pendingPayment", "paid", "system", base),
    ).toMatchObject({ allowed: false, refusal: { code: "paymentNotCaptured" } });
  });

  it("will not let a person mark an order paid", () => {
    // Only the payment webhook may do this.
    expect(
      canAdvanceBuyerOrder("pendingPayment", "paid", "platform", {
        ...base,
        paymentCaptured: true,
      }),
    ).toMatchObject({ allowed: false, refusal: { code: "notPermitted" } });
  });

  it("refunds rather than cancels once money has been taken", () => {
    expect(canAdvanceBuyerOrder("paid", "refunded", "platform", base).allowed).toBe(true);
    expect(canAdvanceBuyerOrder("paid", "cancelled", "platform", base)).toMatchObject({
      allowed: false,
      refusal: { code: "wrongState" },
    });
  });

  it("cancels without refund before payment", () => {
    expect(
      canAdvanceBuyerOrder("pendingPayment", "cancelled", "buyer", base).allowed,
    ).toBe(true);
  });

  it("blocks allocation on an uninsured vehicle", () => {
    expect(
      canAdvanceBuyerOrder("paid", "allocated", "platform", {
        now: NOW,
        vehicle: vehicle({ documents: [doc("rc", null), doc("insurance", -1)] }),
        driver: driver(),
      }),
    ).toMatchObject({ allowed: false, refusal: { code: "vehicleNotDispatchable" } });
  });

  it("does not let the buyer confirm delivery of something never dispatched", () => {
    expect(canAdvanceBuyerOrder("paid", "delivered", "buyer", base)).toMatchObject({
      allowed: false,
      refusal: { code: "wrongState" },
    });
  });

  it.each(BUYER_ORDER_TERMINAL)("treats %s as terminal", (status) => {
    expect(
      canAdvanceBuyerOrder(status, "inTransit", "platform", base),
    ).toMatchObject({ allowed: false, refusal: { code: "terminal" } });
  });

  it("cannot be refunded after completion", () => {
    expect(canAdvanceBuyerOrder("completed", "refunded", "platform", base).allowed).toBe(
      false,
    );
  });
});

describe("transition tables", () => {
  it("declares no transition out of a terminal procurement state", () => {
    for (const transition of PROCUREMENT_TRANSITIONS) {
      expect(PROCUREMENT_TERMINAL).not.toContain(transition.from);
    }
  });

  it("declares no transition out of a terminal buyer state", () => {
    for (const transition of BUYER_ORDER_TRANSITIONS) {
      expect(BUYER_ORDER_TERMINAL).not.toContain(transition.from);
    }
  });

  it("gives every transition at least one actor", () => {
    for (const transition of [...PROCUREMENT_TRANSITIONS, ...BUYER_ORDER_TRANSITIONS]) {
      expect(transition.actors.length).toBeGreaterThan(0);
    }
  });

  it("never allows a transition to its own state", () => {
    for (const transition of [...PROCUREMENT_TRANSITIONS, ...BUYER_ORDER_TRANSITIONS]) {
      expect(transition.from).not.toBe(transition.to);
    }
  });
});

describe("assertProcurement", () => {
  it("passes silently when permitted", () => {
    expect(() => assertProcurement("confirmed", "ready", "farmer", base)).not.toThrow();
  });

  it("throws a TransitionError carrying the refusal code", () => {
    try {
      assertProcurement("confirmed", "paid", "platform", base);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TransitionError);
      expect((error as TransitionError).code).toBe("wrongState");
    }
  });
});
