"use client";

/**
 * Razorpay Checkout, from the browser.
 *
 * The script is loaded on demand rather than in the document head: it is
 * roughly 100 KB and most people looking at a pricing page are looking, not
 * paying. On a village connection that is a real wait for something not being
 * used.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

let loading: Promise<boolean> | undefined;

export function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  // One load in flight at a time — clicking Subscribe twice must not append
  // two script tags.
  if (loading) return loading;

  loading = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      // Blocked by an extension, an offline moment, or a corporate proxy.
      // Reset so a retry can try again rather than resolving false forever.
      loading = undefined;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return loading;
}

export interface CheckoutSession {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly keyId: string;
  readonly planName: string;
  readonly reference: string;
}

export interface CheckoutResult {
  readonly razorpay_order_id: string;
  readonly razorpay_payment_id: string;
  readonly razorpay_signature: string;
}

/**
 * Opens the modal and resolves with what it hands back, or null if dismissed.
 *
 * What comes back is *not* proof of payment — it is a claim, and the server
 * checks its signature before anything is granted. The promise resolving is
 * the beginning of verification, not the end of it.
 */
export function openCheckout(
  session: CheckoutSession,
  prefill: { name?: string; email?: string; contact?: string },
): Promise<CheckoutResult | null> {
  return new Promise((resolve) => {
    if (!window.Razorpay) {
      resolve(null);
      return;
    }

    const razorpay = new window.Razorpay({
      key: session.keyId,
      order_id: session.orderId,
      amount: session.amount,
      currency: session.currency,
      name: "Pasumai Trade",
      description: `${session.planName} subscription`,
      prefill: {
        name: prefill.name ?? "",
        email: prefill.email ?? "",
        // Razorpay wants ten digits or E.164; either works, empty is fine.
        contact: prefill.contact ?? "",
      },
      notes: { reference: session.reference },
      theme: { color: "#2f6b34" },
      handler: (response: CheckoutResult) => resolve(response),
      modal: {
        // Dismissal is not a failure — somebody changed their mind. Resolving
        // null lets the caller stop its spinner without showing an error.
        ondismiss: () => resolve(null),
        escape: true,
      },
    });

    razorpay.open();
  });
}
