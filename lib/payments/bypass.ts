import "server-only";

import { razorpayConfig } from "./razorpay";

/**
 * Skipping payment, on purpose, while the rest of the flow is being built.
 *
 * A subscription that activates without money is exactly the bug somebody
 * would try to introduce deliberately, so this is written as though it were
 * one. Three properties matter more than the feature does:
 *
 *  1. **Off unless asked.** A single env var, absent everywhere by default.
 *     Nothing infers it from NODE_ENV, because "we are probably in dev" is not
 *     a thing to decide free subscriptions on.
 *
 *  2. **Impossible with live keys.** If `RAZORPAY_KEY_ID` is an `rzp_live_`
 *     key, the bypass refuses regardless of the flag and says so in the log.
 *     That is the accident this guards against: the flag left set in an env
 *     file, real keys added later, and every subscription free from then on.
 *     The check is here rather than in a deploy checklist because a checklist
 *     is a thing people forget under time pressure.
 *
 *  3. **Visible wherever it is on.** Every surface that can create a
 *     subscription says so in the interface, and every record it writes is
 *     stamped `paymentMethod: "bypass"` so the fakes can be found and cleared
 *     the day real payments start.
 *
 * Delete this file and its three call sites to remove the capability
 * altogether. It is deliberately small and deliberately easy to grep for.
 */

export const BYPASS_METHOD = "bypass";

let warned = false;

export function paymentsBypassed(): boolean {
  if (process.env.PAYMENTS_BYPASS !== "true") return false;

  const config = razorpayConfig();

  // The safety interlock. A live key means real customers, and no flag in any
  // environment file gets to hand them free subscriptions.
  if (config && config.keyId.startsWith("rzp_live_")) {
    if (!warned) {
      warned = true;
      console.error(
        "PAYMENTS_BYPASS is set but Razorpay is configured with a LIVE key. " +
          "The bypass is disabled. Remove PAYMENTS_BYPASS from this environment.",
      );
    }
    return false;
  }

  return true;
}

/** For the banner. Says what is on and what to do about it. */
export function bypassNotice(): string {
  return "Payment is bypassed for testing — subscriptions activate without charging anything.";
}
