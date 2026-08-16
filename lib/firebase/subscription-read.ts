import "server-only";

import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { isTerm, type Subscription, type SubscriptionStatus, type Term } from "@/lib/domain/subscription";
import type { Role } from "@/lib/auth/claims";
import { money } from "@/lib/domain/money";

import { adminDb } from "./admin";

/**
 * The subscription lives on the account document.
 *
 * Not in a collection of its own: every guard that needs it already has to
 * load the account to know whether it is suspended, so a separate document
 * would be a second read on the hot path for one field. One account, one
 * subscription — if that stops being true, this is the thing to split.
 */

const STATUSES: SubscriptionStatus[] = [
  "requested",
  "trialing",
  "active",
  "pastDue",
  "expired",
  "cancelled",
];

/** Firestore hands back Timestamps; the domain works in Dates. */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date };
  return typeof stamp.toDate === "function" ? stamp.toDate() : undefined;
}

function readTerm(data: Record<string, unknown>): Term {
  if (typeof data.term === "string" && isTerm(data.term)) return data.term;
  return data.period === "yearly" ? "y1" : "m1";
}

export function shapeSubscription(raw: unknown): Subscription | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  const status = data.status;
  const startedAt = toDate(data.startedAt);
  const renewsAt = toDate(data.renewsAt);

  // A record missing any of these cannot be reasoned about, and guessing at a
  // renewal date would be inventing access. Treated as no subscription, which
  // refuses rather than grants.
  if (
    typeof status !== "string" ||
    !STATUSES.includes(status as SubscriptionStatus) ||
    !startedAt ||
    !renewsAt
  ) {
    return null;
  }

  const amount = data.amount as { minorUnits?: unknown; currency?: unknown } | undefined;

  return {
    planId: typeof data.planId === "string" ? data.planId : "",
    status: status as SubscriptionStatus,
    startedAt,
    renewsAt,
    paidAt: toDate(data.paidAt),
    reference: typeof data.reference === "string" ? data.reference : "",
    amount: money(
      typeof amount?.minorUnits === "number" ? amount.minorUnits : 0,
      typeof amount?.currency === "string" ? amount.currency : "INR",
    ),
    // Records written before the term ladder carry `period: "monthly" | "yearly"`.
    // Mapped rather than dropped, so an existing subscriber keeps what they paid
    // for instead of silently reading as a one-month plan.
    term: readTerm(data),
    renewal: data.renewal === true,
  };
}

export interface AccountState {
  readonly subscription: Subscription | null;
  /** Operations rejected or suspended this account. */
  readonly blocked: boolean;
  readonly exists: boolean;
}

/**
 * Everything a capability check needs, in one read.
 *
 * Returns `exists: false` rather than throwing when the account document is
 * missing. A session whose account was deleted is not an error to shout about,
 * it is simply an identity that can do nothing — and `blocked: true` makes the
 * guards refuse it without any of them needing to know why.
 */
export async function readAccountState(
  role: Role,
  accountId: string | undefined,
): Promise<AccountState> {
  if (!accountId || !canSelfSignup(role)) {
    return { subscription: null, blocked: false, exists: false };
  }

  const snapshot = await adminDb()
    .collection(COLLECTION_FOR_SIGNUP[role])
    .doc(accountId)
    .get();

  if (!snapshot.exists) {
    return { subscription: null, blocked: true, exists: false };
  }

  const data = snapshot.data()!;
  return {
    subscription: shapeSubscription(data.subscription),
    blocked: data.status === "rejected" || data.status === "suspended",
    exists: true,
  };
}
