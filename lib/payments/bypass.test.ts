import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { paymentsBypassed } from "./bypass";

/**
 * The interlock, tested as though somebody were trying to defeat it.
 *
 * The failure this guards against is not malice, it is sequence: the flag set
 * during testing, forgotten, and live keys added a week later. From that moment
 * every subscription would be free and nothing would look wrong.
 */
const KEEP = { ...process.env };

beforeEach(() => {
  delete process.env.PAYMENTS_BYPASS;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

afterEach(() => {
  process.env = { ...KEEP };
});

describe("payments bypass", () => {
  it("is off when nothing is set", () => {
    expect(paymentsBypassed()).toBe(false);
  });

  it("is off for every value except exactly \"true\"", () => {
    for (const value of ["", "false", "0", "yes", "TRUE", "1", " true"]) {
      process.env.PAYMENTS_BYPASS = value;
      expect(paymentsBypassed()).toBe(false);
    }
  });

  it("is on when asked, with no keys configured at all", () => {
    process.env.PAYMENTS_BYPASS = "true";
    expect(paymentsBypassed()).toBe(true);
  });

  it("is on alongside test keys", () => {
    process.env.PAYMENTS_BYPASS = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_TGpDYn31bQejhA";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(paymentsBypassed()).toBe(true);
  });

  it("REFUSES with a live key, however the flag is set", () => {
    // The whole point of the file.
    process.env.PAYMENTS_BYPASS = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_live_SomethingReal";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(paymentsBypassed()).toBe(false);
  });

  it("does not infer itself from the environment", () => {
    // "We are probably in development" is not a thing to grant free
    // subscriptions on. NODE_ENV is deliberately never consulted, so running
    // here — where it is "test" — must still be off without the flag.
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(paymentsBypassed()).toBe(false);
  });
});
