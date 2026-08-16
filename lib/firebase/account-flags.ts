import "server-only";

import type { Role } from "@/lib/auth/claims";
import type { VerificationStatus } from "@/lib/domain/admin";
import type { Check } from "@/lib/domain/kyc";
import { accountFlags, type AccountFlags } from "@/lib/domain/readiness";
import type { Subscription } from "@/lib/domain/subscription";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";

import { adminDb } from "./admin";
import { shapeChecks } from "./kyc-read";
import { shapeSubscription } from "./subscription-read";

/**
 * The account, its checks, its subscription and the flags — in one read.
 *
 * Everything lives on the same document, so asking three questions about an
 * account should cost one lookup. It was costing three: `readAccountState`,
 * `readChecks` and `readFarmer` each fetched the same record on the same page
 * render.
 */

export interface AccountSnapshot {
  readonly exists: boolean;
  readonly status: VerificationStatus;
  readonly checks: Check[];
  readonly subscription: Subscription | null;
  readonly flags: AccountFlags;
  /** The raw document, for callers that need fields beyond the flags. */
  readonly data: Record<string, unknown>;
}

const STATUSES: VerificationStatus[] = ["pending", "verified", "rejected", "suspended"];

/** Missing or unreadable, and treated as blocked so every guard fails closed. */
function missing(role: Role, now: Date): AccountSnapshot {
  return {
    exists: false,
    status: "pending",
    checks: [],
    subscription: null,
    flags: accountFlags({
      role,
      checks: [],
      subscription: null,
      // A session pointing at no account can do nothing. Not an error to shout
      // about, just an identity with nothing behind it.
      status: "suspended",
      now,
    }),
    data: {},
  };
}

export async function readAccount(
  role: Role,
  accountId: string | undefined,
  now: Date,
): Promise<AccountSnapshot> {
  if (!accountId || !canSelfSignup(role)) return missing(role, now);

  const snapshot = await adminDb()
    .collection(COLLECTION_FOR_SIGNUP[role])
    .doc(accountId)
    .get();

  if (!snapshot.exists) return missing(role, now);

  const data = snapshot.data()!;
  const status =
    typeof data.status === "string" && STATUSES.includes(data.status as VerificationStatus)
      ? (data.status as VerificationStatus)
      : // Unreadable reads as pending, never as verified: the wrong guess in
        // that direction hands out a badge and the dispatch rights with it.
        "pending";

  const checks = shapeChecks(data.kyc);
  const subscription = shapeSubscription(data.subscription);

  return {
    exists: true,
    status,
    checks,
    subscription,
    flags: accountFlags({ role, checks, subscription, status, now }),
    data,
  };
}
