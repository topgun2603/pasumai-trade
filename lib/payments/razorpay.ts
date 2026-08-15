import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Money } from "@/lib/domain/money";

/**
 * Razorpay, over plain fetch.
 *
 * No SDK: the three calls this platform makes are ordinary REST with HTTP Basic
 * auth, and signature verification is an HMAC. A dependency that wraps that
 * would be a supply-chain surface sitting directly on the payment path, which
 * is the last place to add one for the sake of four lines.
 *
 * Amounts need no conversion. Razorpay counts in paise and so does this
 * codebase, all the way down — `Money.minorUnits` goes across as-is. A float
 * of rupees never exists at any point, which is the whole reason money is
 * integers here.
 */

const API = "https://api.razorpay.com/v1";

export interface RazorpayConfig {
  readonly keyId: string;
  readonly keySecret: string;
  /** Set only when a webhook endpoint is configured; verification needs it. */
  readonly webhookSecret?: string;
}

/**
 * Reads the keys, or says why it cannot.
 *
 * Returns null rather than throwing so a deployment without payment
 * credentials degrades to "checkout is unavailable" instead of a 500 on a page
 * somebody was only browsing.
 */
export function razorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET };
}

/** Test keys are `rzp_test_…`. Worth showing so nobody demos live by accident. */
export function isTestKey(keyId: string): boolean {
  return keyId.startsWith("rzp_test_");
}

function authHeader(config: RazorpayConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

export interface RazorpayOrder {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
}

/**
 * Creates the order the checkout modal is opened against.
 *
 * `receipt` carries our own reference so a payment can be traced back from the
 * Razorpay dashboard without a lookup table, and `notes` carry the account and
 * plan — Razorpay echoes both back on the webhook, which is what lets a webhook
 * arriving with no browser attached still know whose subscription to start.
 */
export async function createOrder(
  config: RazorpayConfig,
  input: {
    amount: Money;
    receipt: string;
    notes: Record<string, string>;
  },
): Promise<RazorpayOrder> {
  const response = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { authorization: authHeader(config), "content-type": "application/json" },
    body: JSON.stringify({
      amount: input.amount.minorUnits,
      currency: input.amount.currency,
      // Razorpay caps this at 40 characters and rejects longer ones outright.
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }),
  });

  const data = (await response.json()) as
    | RazorpayOrder
    | { error?: { description?: string; code?: string } };

  if (!response.ok || !("id" in data)) {
    const detail =
      "error" in data ? (data.error?.description ?? data.error?.code) : undefined;
    throw new Error(`Razorpay refused the order: ${detail ?? response.status}`);
  }

  return data;
}

/** A payment as Razorpay reports it, once fetched back for confirmation. */
export interface RazorpayPayment {
  readonly id: string;
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  readonly order_id: string;
  readonly method?: string;
}

export async function fetchPayment(
  config: RazorpayConfig,
  paymentId: string,
): Promise<RazorpayPayment | null> {
  const response = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: authHeader(config) },
  });
  if (!response.ok) return null;
  return (await response.json()) as RazorpayPayment;
}

/* -------------------------------------------------------------------------
   Signatures
   ------------------------------------------------------------------------- */

/**
 * Constant-time compare of two hex digests.
 *
 * `===` on a signature leaks how many leading characters matched through how
 * long the comparison took. That is a real attack on an HMAC check, and the fix
 * costs nothing.
 */
function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // signal — so length is checked first and answered identically.
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies what the checkout modal handed back to the browser.
 *
 * This is the line that decides whether a subscription starts. The browser is
 * not trusted with "payment succeeded" — anyone can call the verify endpoint
 * with any order id — so the claim is only believed if it carries an HMAC that
 * could only have been produced by someone holding the key secret, which is
 * Razorpay.
 *
 * The signed message is `order_id|payment_id`, per Razorpay's documented scheme.
 */
export function verifyCheckoutSignature(
  config: RazorpayConfig,
  input: { orderId: string; paymentId: string; signature: string },
): boolean {
  const expected = createHmac("sha256", config.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return sameDigest(expected, input.signature);
}

/**
 * Verifies a webhook body.
 *
 * Signed over the *raw* body, so the caller must pass the exact bytes received
 * — re-serialising a parsed object reorders keys and changes whitespace, and
 * the signature stops matching for reasons that look like an attack.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return sameDigest(expected, signature);
}
