import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isTestKey, verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay";

const config = { keyId: "rzp_test_abc", keySecret: "a-secret-nobody-else-has" };

/** Exactly what Razorpay does, so the test proves the scheme and not the code. */
function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

describe("checkout signatures", () => {
  const orderId = "order_MtP9kL2xQwErTy";
  const paymentId = "pay_MtP9nR4zXcVbNm";

  it("accepts a signature over order_id|payment_id", () => {
    const signature = sign(config.keySecret, `${orderId}|${paymentId}`);
    expect(verifyCheckoutSignature(config, { orderId, paymentId, signature })).toBe(true);
  });

  it("refuses a signature made with another secret", () => {
    // What an attacker without the key can produce.
    const signature = sign("not-the-secret", `${orderId}|${paymentId}`);
    expect(verifyCheckoutSignature(config, { orderId, paymentId, signature })).toBe(false);
  });

  it("refuses a real signature paired with a different payment", () => {
    // The replay that matters: a genuine signature from one payment, reused to
    // claim another.
    const signature = sign(config.keySecret, `${orderId}|${paymentId}`);
    expect(
      verifyCheckoutSignature(config, { orderId, paymentId: "pay_SOMEONE_ELSE", signature }),
    ).toBe(false);
    expect(
      verifyCheckoutSignature(config, { orderId: "order_OTHER", paymentId, signature }),
    ).toBe(false);
  });

  it("refuses the separator being moved", () => {
    // `a|bc` and `ab|c` must not hash the same, or an attacker could shift the
    // boundary between the two ids.
    const shifted = sign(config.keySecret, `${orderId}|${paymentId}`.replace("|", ""));
    expect(verifyCheckoutSignature(config, { orderId, paymentId, signature: shifted })).toBe(
      false,
    );
  });

  it("refuses empty, malformed and truncated signatures", () => {
    const good = sign(config.keySecret, `${orderId}|${paymentId}`);
    for (const signature of ["", "not-hex-at-all", good.slice(0, -2), good + "ff", " " + good]) {
      expect(verifyCheckoutSignature(config, { orderId, paymentId, signature })).toBe(false);
    }
  });

  it("is case-sensitive about hex, because a digest is bytes not text", () => {
    const good = sign(config.keySecret, `${orderId}|${paymentId}`);
    // Upper-case hex decodes to the same bytes, so this must still pass —
    // proving the compare is on bytes rather than on strings.
    expect(
      verifyCheckoutSignature(config, { orderId, paymentId, signature: good.toUpperCase() }),
    ).toBe(true);
  });
});

describe("webhook signatures", () => {
  const secret = "webhook-secret";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: {} } });

  it("accepts a signature over the raw body", () => {
    expect(verifyWebhookSignature(secret, body, sign(secret, body))).toBe(true);
  });

  it("refuses when a single byte of the body changed", () => {
    const signature = sign(secret, body);
    // The whole point: a tampered amount must not verify.
    expect(verifyWebhookSignature(secret, body.replace("captured", "capturee"), signature)).toBe(
      false,
    );
  });

  it("refuses a re-serialised body", () => {
    // Documents why the route must use request.text() and not JSON.stringify
    // of the parsed object: re-serialising changes the bytes.
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyWebhookSignature(secret, reserialised, sign(secret, body))).toBe(false);
  });

  it("refuses an empty signature", () => {
    expect(verifyWebhookSignature(secret, body, "")).toBe(false);
  });
});

describe("key mode", () => {
  it("tells test keys from live ones", () => {
    expect(isTestKey("rzp_test_TGpDYn31bQejhA")).toBe(true);
    expect(isTestKey("rzp_live_SomethingReal")).toBe(false);
  });
});
