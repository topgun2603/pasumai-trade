import type { Role } from "@/lib/auth/claims";

import { money, rupees, type Money } from "./money";

/**
 * Who pays for what.
 *
 * The platform is open. Anyone may register, sign in, and look at everything:
 * what is growing, what it graded at, what it settled for, which agencies
 * cover which districts. That is deliberate — a marketplace nobody can see
 * into cannot attract the side of the trade it is short of, and a farmer who
 * cannot see buyer prices before joining has no reason to join.
 *
 * Acting costs money. Posting a lot, opening a bargain, placing an order,
 * putting a vehicle or a crew on the platform — those need a subscription.
 *
 * The split is drawn once, here, as data. Every guard reads this table rather
 * than deciding for itself, so "is this free?" has exactly one answer and
 * adding a capability forces a decision about which side it falls on.
 */

/* -------------------------------------------------------------------------
   Capabilities
   ------------------------------------------------------------------------- */

export const CAPABILITIES = [
  /** See the market, listings, settled prices, agency coverage. */
  "browse",
  /** Put produce up for sale. */
  "postListing",
  /** Open a bargain, propose a price, accept one. */
  "bargain",
  /** Turn an agreed bargain into a procurement order. */
  "order",
  /** Add a vehicle or a driver to a transport agency. */
  "addFleet",
  /** Add a worker to a manpower agency. */
  "addCrew",
  /** Take a dispatch job. */
  "dispatch",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The free tier, in full.
 *
 * Everything not in this set needs a subscription. Kept as a list of what is
 * free rather than a list of what is paid, because the failure that matters is
 * a new capability silently defaulting to free — this way a capability nobody
 * classified is paid, which is the safe direction to be wrong in.
 */
export const FREE_CAPABILITIES: readonly Capability[] = ["browse"];

export function isFree(capability: Capability): boolean {
  return FREE_CAPABILITIES.includes(capability);
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  browse: "Browse the market",
  postListing: "Post a listing",
  bargain: "Bargain on price",
  order: "Place an order",
  addFleet: "Add vehicles and drivers",
  addCrew: "Add workers",
  dispatch: "Take dispatch jobs",
};

/** Which capabilities each role could ever use. A farmer never adds a fleet. */
export const CAPABILITIES_FOR_ROLE: Record<Role, readonly Capability[]> = {
  admin: [...CAPABILITIES],
  farmer: ["browse", "postListing", "bargain"],
  franchise: ["browse", "bargain", "order"],
  buyer: ["browse", "bargain", "order"],
  transport: ["browse", "addFleet", "dispatch"],
  manpower: ["browse", "addCrew", "dispatch"],
};

/* -------------------------------------------------------------------------
   The subscription record
   ------------------------------------------------------------------------- */

export type SubscriptionStatus =
  /** Chosen a plan, not paid yet. Operations sees it; it grants nothing. */
  | "requested"
  /** Inside a free trial. Grants everything the plan grants. */
  | "trialing"
  /** Paid and current. */
  | "active"
  /** Was active, renewal did not arrive. Still works, inside the grace window. */
  | "pastDue"
  /** Ran out. */
  | "expired"
  /** Stopped on purpose, by them or by operations. */
  | "cancelled";

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  requested: "Awaiting payment",
  trialing: "Trial",
  active: "Active",
  pastDue: "Payment overdue",
  expired: "Expired",
  cancelled: "Cancelled",
};

export interface Subscription {
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: Date;
  /** When the paid period ends. Access survives to here, then to the grace window. */
  readonly renewsAt: Date;
  /** Set when payment is confirmed. Absent while `requested`. */
  readonly paidAt?: Date;
  /** What operations quotes on the phone, and what the payer puts in the reference. */
  readonly reference: string;
  readonly amount: Money;
  readonly period: BillingPeriod;
}

export type BillingPeriod = "monthly" | "yearly";

/**
 * Days a lapsed subscription keeps working.
 *
 * A bank transfer that clears on Monday for a subscription that ended on
 * Saturday should not cost a farmer the weekend's listings. Long enough to
 * cover a bank holiday, short enough that it is not a free month.
 */
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

export function isWithinGrace(subscription: Subscription, now: Date): boolean {
  return now.getTime() <= subscription.renewsAt.getTime() + GRACE_DAYS * DAY_MS;
}

/**
 * Does this subscription grant anything right now?
 *
 * Status alone is not enough: an `active` record whose period ended two months
 * ago is a record nobody got round to updating, and reading it as access would
 * mean a lapsed subscription keeps working until a cron that may not run
 * notices. So the date is checked too, every time.
 */
export function isSubscribed(
  subscription: Subscription | null | undefined,
  now: Date,
): boolean {
  if (!subscription) return false;

  switch (subscription.status) {
    case "trialing":
    case "active":
      return now.getTime() <= subscription.renewsAt.getTime();
    case "pastDue":
      return isWithinGrace(subscription, now);
    case "requested":
    case "expired":
    case "cancelled":
      return false;
  }
}

/** What the account should be shown as, given the clock. */
export function effectiveStatus(
  subscription: Subscription | null | undefined,
  now: Date,
): SubscriptionStatus | "none" {
  if (!subscription) return "none";
  if (
    (subscription.status === "active" || subscription.status === "trialing") &&
    now.getTime() > subscription.renewsAt.getTime()
  ) {
    // Lapsed by the calendar even though nothing has rewritten the record.
    return isWithinGrace(subscription, now) ? "pastDue" : "expired";
  }
  return subscription.status;
}

export function daysRemaining(subscription: Subscription, now: Date): number {
  return Math.ceil((subscription.renewsAt.getTime() - now.getTime()) / DAY_MS);
}

/* -------------------------------------------------------------------------
   The gate
   ------------------------------------------------------------------------- */

export type CapabilityResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly code: "notForRole" | "accountBlocked" | "needsSubscription";
      readonly reason: string;
    };

const GRANTED: CapabilityResult = { allowed: true };

/**
 * May this account do this, right now?
 *
 * One function, called by every route and every button. The refusal carries a
 * code so the UI can tell "you need to subscribe" — which is a thing the person
 * can fix in two minutes — apart from "your account is suspended", which is
 * not, and which should not show them a price list.
 */
export function checkCapability(
  capability: Capability,
  context: {
    readonly role: Role;
    readonly subscription: Subscription | null | undefined;
    /** True when operations have rejected or suspended the account. */
    readonly blocked?: boolean;
    readonly now: Date;
  },
): CapabilityResult {
  // Operations are staff, not customers. Billing them for their own console
  // would be absurd, and a lapsed card must never lock out the people who fix
  // everyone else's.
  if (context.role === "admin") return GRANTED;

  if (!CAPABILITIES_FOR_ROLE[context.role].includes(capability)) {
    return {
      allowed: false,
      code: "notForRole",
      reason: `A ${context.role} account cannot ${CAPABILITY_LABELS[capability].toLowerCase()}.`,
    };
  }

  // Browsing survives everything. A suspended account can still see why, and
  // an expired one can still see what it is missing — which is also the only
  // thing likely to make them renew.
  if (isFree(capability)) return GRANTED;

  // Checked before the subscription, so a suspended account is not sold a plan
  // that will not help it.
  if (context.blocked) {
    return {
      allowed: false,
      code: "accountBlocked",
      reason: "Your account is on hold. Operations will have been in touch.",
    };
  }

  if (!isSubscribed(context.subscription, context.now)) {
    const status = effectiveStatus(context.subscription, context.now);
    return {
      allowed: false,
      code: "needsSubscription",
      reason:
        status === "expired" || status === "pastDue"
          ? `Your subscription has ${status === "expired" ? "expired" : "lapsed"}. Renew to ${CAPABILITY_LABELS[capability].toLowerCase()}.`
          : status === "requested"
            ? "Your subscription is waiting on payment. It starts the moment it clears."
            : `Subscribe to ${CAPABILITY_LABELS[capability].toLowerCase()}.`,
    };
  }

  return GRANTED;
}

/* -------------------------------------------------------------------------
   Plans
   ------------------------------------------------------------------------- */

export interface Plan {
  readonly id: string;
  readonly role: Role;
  readonly name: string;
  readonly blurb: string;
  /** Per month, in paise. */
  readonly monthly: Money;
  /** Per year, in paise. Cheaper than twelve months or there is no reason to pick it. */
  readonly yearly: Money;
  readonly includes: readonly string[];
}

/**
 * Opening prices.
 *
 * Deliberately low, and deliberately different per role: a farmer with two
 * acres and a buyer running six outlets are not the same customer, and one
 * price for both would be too much for the first or nothing to the second.
 *
 * These are a starting point for operations to change, not a decision the code
 * owns — same reasoning as the policy dials. They are editable in Controls.
 */
export const DEFAULT_PLANS: readonly Plan[] = [
  {
    id: "farmer-grower",
    role: "farmer",
    name: "Grower",
    blurb: "List what you grow and bargain on your own price.",
    monthly: rupees(99),
    yearly: rupees(999),
    includes: [
      "Unlimited listings",
      "Bargain directly with buyers",
      "See what every grade settled at",
      "Payment on delivery, tracked",
    ],
  },
  {
    id: "buyer-trade",
    role: "buyer",
    name: "Trade",
    blurb: "Buy direct from farmers, graded and traceable.",
    monthly: rupees(499),
    yearly: rupees(4999),
    includes: [
      "Bargain with any farmer on the platform",
      "Place orders and track them to delivery",
      "Grade-by-grade price history",
      "Book transport and crew",
    ],
  },
  {
    id: "franchise-outlet",
    role: "franchise",
    name: "Outlet",
    blurb: "Source for a franchise, across districts.",
    monthly: rupees(999),
    yearly: rupees(9999),
    includes: [
      "Everything in Trade",
      "Source across every district you cover",
      "Onboard farmers to the platform",
      "Consolidated settlement",
    ],
  },
  {
    id: "transport-fleet",
    role: "transport",
    name: "Fleet",
    blurb: "Put your vehicles in front of every buyer.",
    monthly: rupees(799),
    yearly: rupees(7999),
    includes: [
      "Unlimited vehicles and drivers",
      "Dispatch jobs across your districts",
      "Document expiry warnings before they bite",
      "Paid per completed trip",
    ],
  },
  {
    id: "manpower-crew",
    role: "manpower",
    name: "Crew",
    blurb: "Supply harvest and grading labour.",
    monthly: rupees(799),
    yearly: rupees(7999),
    includes: [
      "Unlimited workers",
      "Jobs across your districts",
      "Skill and document tracking",
      "Paid per completed job",
    ],
  },
];

export function plansForRole(role: Role, plans: readonly Plan[] = DEFAULT_PLANS): Plan[] {
  return plans.filter((plan) => plan.role === role);
}

export function planById(
  id: string,
  plans: readonly Plan[] = DEFAULT_PLANS,
): Plan | undefined {
  return plans.find((plan) => plan.id === id);
}

export function priceFor(plan: Plan, period: BillingPeriod): Money {
  return period === "yearly" ? plan.yearly : plan.monthly;
}

/** What a year costs against twelve months of it, as a percentage. */
export function yearlySaving(plan: Plan): number {
  const twelve = plan.monthly.minorUnits * 12;
  if (twelve === 0) return 0;
  return Math.round(((twelve - plan.yearly.minorUnits) / twelve) * 100);
}

/* -------------------------------------------------------------------------
   Starting one
   ------------------------------------------------------------------------- */

const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * A payment reference somebody has to read down a phone line.
 *
 * No I, O, 0 or 1 — a reference that arrives as "PT-I0" when it left as
 * "PT-1O" is an unmatched bank transfer and a phone call to operations.
 */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function subscriptionReference(random: string): string {
  let out = "";
  for (const char of random.slice(0, 6)) {
    out += REFERENCE_ALPHABET[char.charCodeAt(0) % REFERENCE_ALPHABET.length];
  }
  return `PT-${out}`;
}

/**
 * The record a "subscribe" click creates.
 *
 * `requested`, never active: there is no payment gateway wired up yet, so
 * nothing here can know that money arrived. Operations confirm the transfer
 * and activate it. Minting an active subscription on click would be the code
 * asserting a payment it has no way to observe.
 */
export function requestSubscription(
  plan: Plan,
  period: BillingPeriod,
  reference: string,
  now: Date,
): Subscription {
  return {
    planId: plan.id,
    status: "requested",
    startedAt: now,
    renewsAt: new Date(now.getTime() + (period === "yearly" ? YEAR_MS : MONTH_MS)),
    reference,
    amount: priceFor(plan, period),
    period,
  };
}

/**
 * Payment confirmed.
 *
 * The paid period runs from confirmation, not from when they clicked. Someone
 * who requests on the 1st and pays on the 5th gets a full period — charging
 * them for four days spent waiting on a bank transfer is how a first
 * subscription becomes the last one.
 */
export function activate(subscription: Subscription, paidAt: Date): Subscription {
  return {
    ...subscription,
    status: "active",
    paidAt,
    renewsAt: new Date(
      paidAt.getTime() + (subscription.period === "yearly" ? YEAR_MS : MONTH_MS),
    ),
  };
}

/** Renewal extends from the existing end date, so nobody loses days by paying early. */
export function renew(subscription: Subscription, paidAt: Date): Subscription {
  const from = Math.max(subscription.renewsAt.getTime(), paidAt.getTime());
  return {
    ...subscription,
    status: "active",
    paidAt,
    renewsAt: new Date(from + (subscription.period === "yearly" ? YEAR_MS : MONTH_MS)),
  };
}

export const ZERO_MONEY = money(0);
