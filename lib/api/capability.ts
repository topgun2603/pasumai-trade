import "server-only";

import type { Role } from "@/lib/auth/claims";
import type { Session } from "@/lib/auth/session";
import { checkCapability, isFree, type Capability } from "@/lib/domain/subscription";
import { readAccount } from "@/lib/firebase/account-flags";

import { requireRole, type Gate } from "./write-guard";

/**
 * The gate on every paid action, on the server.
 *
 * The UI hides locked buttons, which is a courtesy to the person using it and
 * nothing more — a locked button is a `fetch` away from being unlocked by
 * anyone who opens the console. This is the check that decides.
 *
 * Two flags, in the order the person meets them:
 *
 *   1. **eKYC done.** Identity and the rest of the required checks cleared.
 *      Refused as 403 `needsVerification`, because paying will not fix it.
 *   2. **Subscription done.** Refused as 402 `needsSubscription` — the one
 *      status code that means "this would work if you paid", which the client
 *      keys its subscribe prompt off rather than matching message text.
 *
 * Verification first is not arbitrary. Taking somebody's money and then failing
 * their identity check is a refund and an apology, and doing it in that order
 * means the platform never holds money from an account it will not let trade.
 *
 * Both are read fresh on every call rather than trusted from a claim. A
 * subscription that lapsed an hour ago must stop working an hour ago, and
 * claims are only as current as the token — up to an hour stale, which is
 * exactly the window somebody would notice.
 */
export type CapabilityGate =
  | { readonly ok: true; readonly session: Session }
  | { readonly ok: false; readonly response: Response };

export async function requireCapability(
  capability: Capability,
  ...roles: readonly Role[]
): Promise<CapabilityGate> {
  const gate: Gate = await requireRole(...roles);
  if (!gate.ok) return gate;

  const { claims } = gate.session;

  // Operations pay for nothing and verify nothing. Billing the people who fix
  // everyone else's account would be absurd, and a lapsed card must never lock
  // them out.
  if (claims.role === "admin") return { ok: true, session: gate.session };

  const now = new Date();
  const account = await readAccount(claims.role, claims.accountId, now);
  const { flags } = account;

  // Free capabilities survive everything short of a suspension. An expired
  // account can still see what it is missing, which is also the only thing
  // likely to make it come back.
  if (!isFree(capability)) {
    if (flags.blocked) {
      return {
        ok: false,
        response: Response.json(
          {
            error: "Your account is on hold. Operations will have been in touch.",
            code: "accountBlocked",
            capability,
          },
          { status: 403 },
        ),
      };
    }

    if (!flags.ekycDone) {
      return {
        ok: false,
        response: Response.json(
          {
            error: flags.awaitingReview
              ? "Your verification is with operations. This opens as soon as it clears."
              : "Finish verifying your account first — it is the step before this one.",
            code: "needsVerification",
            capability,
            awaitingReview: flags.awaitingReview,
          },
          { status: 403 },
        ),
      };
    }
  }

  // Subscription, and the role's own limits on what it may ever do.
  const check = checkCapability(capability, {
    role: claims.role,
    subscription: account.subscription,
    blocked: flags.blocked,
    now,
  });

  if (check.allowed) return { ok: true, session: gate.session };

  return {
    ok: false,
    response: Response.json(
      { error: check.reason, code: check.code, capability },
      { status: check.code === "needsSubscription" ? 402 : 403 },
    ),
  };
}
