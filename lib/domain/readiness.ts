import type { Role } from "@/lib/auth/claims";

import { blocked as isBlocked, type VerificationStatus } from "./admin";
import { kycState, needsHumanReview, type Check } from "./kyc";
import { isSubscribed, type Subscription } from "./subscription";

/**
 * The two flags an account is judged by, and the road between them.
 *
 * Everything the platform gates on reduces to two questions: is this person
 * who they say they are, and are they paying. Those were being answered in a
 * dozen places from three different shapes of data — a status string, a check
 * array, a subscription record — and each caller was drawing its own
 * conclusion. This is the one place that draws it.
 *
 * **Derived, not stored.** There is no `ekycDone: true` column, deliberately.
 * A stored flag is a flag that disagrees with the checks under it the first
 * time one is re-run or a subscription lapses at midnight, and then the console
 * says verified while the guard says no. These are computed from the records
 * every time they are asked for, which costs one read the caller was making
 * anyway.
 */

export interface AccountFlags {
  /** Identity and the rest of the required checks are cleared. */
  readonly ekycDone: boolean;
  /** A subscription is live right now, judged against the clock. */
  readonly subscriptionDone: boolean;
  /** Submitted, but a person still has to look. Not a failure — a wait. */
  readonly awaitingReview: boolean;
  /** Operations rejected or suspended the account. Nothing gets past this. */
  readonly blocked: boolean;
}

export function accountFlags(input: {
  role: Role;
  checks: readonly Check[];
  subscription: Subscription | null | undefined;
  status: VerificationStatus;
  now: Date;
}): AccountFlags {
  return {
    ekycDone: kycState([...input.checks], input.role) === "verified",
    subscriptionDone: isSubscribed(input.subscription, input.now),
    awaitingReview: needsHumanReview([...input.checks], input.role),
    blocked: isBlocked(input.status),
  };
}

/** True when the account can do everything its role allows. */
export function isReady(flags: AccountFlags): boolean {
  return flags.ekycDone && flags.subscriptionDone && !flags.blocked;
}

/* -------------------------------------------------------------------------
   The journey
   ------------------------------------------------------------------------- */

export type StepId = "register" | "verify" | "subscribe" | "trade";

export type StepState =
  | "done"
  /** The one thing to do next. Exactly one step is ever current. */
  | "current"
  /** Submitted, waiting on somebody else. Cannot be hurried. */
  | "waiting"
  /** Not reachable yet, because an earlier step is not done. */
  | "locked"
  | "blocked";

export interface JourneyStep {
  readonly id: StepId;
  readonly title: string;
  readonly detail: string;
  readonly state: StepState;
  readonly href?: string;
}

/**
 * The farmer's road onto the platform, as four steps.
 *
 * Ordered by dependency and not by preference: verification before payment,
 * because taking money from somebody who then fails verification is a refund
 * and an apology. Registration is included even though it is behind them —
 * a checklist that starts at step two makes the remaining work look longer
 * than it is, and the first tick is the one that makes the rest feel doable.
 *
 * `waiting` exists as a state distinct from `current` for the manual queue.
 * Showing "Verify your identity" as the next action to somebody who submitted
 * it yesterday reads as though their submission was lost.
 */
export function farmerJourney(flags: AccountFlags): JourneyStep[] {
  const verifyState: StepState = flags.blocked
    ? "blocked"
    : flags.ekycDone
      ? "done"
      : flags.awaitingReview
        ? "waiting"
        : "current";

  const subscribeState: StepState = flags.blocked
    ? "blocked"
    : flags.subscriptionDone
      ? "done"
      : // Reachable while verification is still in the queue: there is no
        // reason to make somebody wait two days before they can pay, and a
        // subscription bought now starts the day the verification clears.
        flags.ekycDone || flags.awaitingReview
        ? "current"
        : "locked";

  const tradeState: StepState = flags.blocked
    ? "blocked"
    : isReady(flags)
      ? "done"
      : "locked";

  return [
    {
      id: "register",
      title: "Register",
      detail: "Done — your account exists and you are signed in.",
      state: "done",
    },
    {
      id: "verify",
      title: "Verify who you are",
      detail:
        verifyState === "done"
          ? "Verified. Nothing more needed."
          : verifyState === "waiting"
            ? "Submitted. Operations are checking it — usually within two working days."
            : verifyState === "blocked"
              ? "Your account is on hold. Operations will have been in touch."
              : "Aadhaar and the bank account you want to be paid into.",
      state: verifyState,
      href: "/farm/account/verification",
    },
    {
      id: "subscribe",
      title: "Take a plan",
      detail:
        subscribeState === "done"
          ? "Active. Posting and bargaining are open."
          : subscribeState === "locked"
            ? "Available once your verification is submitted."
            : "₹99 a month. Looking stays free either way.",
      state: subscribeState,
      href: "/farm/account/subscription",
    },
    {
      id: "trade",
      title: "Post your produce",
      detail:
        tradeState === "done"
          ? "You are set. Post what is ready and bargain on the price."
          : "Opens when the two steps above are done.",
      state: tradeState,
      href: "/farm/listings",
    },
  ];
}

/** The single next thing, for a one-line prompt rather than a whole checklist. */
export function nextStep(steps: readonly JourneyStep[]): JourneyStep | undefined {
  return steps.find((s) => s.state === "current");
}
