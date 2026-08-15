import "server-only";

import type { Role } from "@/lib/auth/claims";
import type { Session } from "@/lib/auth/session";
import { checkCapability, type Capability } from "@/lib/domain/subscription";
import { readAccountState } from "@/lib/firebase/subscription-read";

import { requireRole, type Gate } from "./write-guard";

/**
 * The paywall, on the server.
 *
 * The UI hides locked buttons, which is a courtesy to the person using it and
 * nothing more — a locked button is a `fetch` away from being unlocked by
 * anyone who opens the console. This is the check that decides.
 *
 * Reads the account fresh on every call rather than trusting a claim. A
 * subscription that lapsed an hour ago must stop working an hour ago, and
 * claims are only as current as the token — up to an hour stale, which is
 * precisely the window somebody would notice.
 *
 * Returns 402 for a missing subscription, which is the one status code that
 * says "this would work if you paid". The client keys the subscribe prompt off
 * it rather than off matching the message text.
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
  const state = await readAccountState(claims.role, claims.accountId);

  const check = checkCapability(capability, {
    role: claims.role,
    subscription: state.subscription,
    blocked: state.blocked,
    now: new Date(),
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
