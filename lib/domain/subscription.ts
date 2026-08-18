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
  /**
   * When the paid term ends. Access survives to here, then to the grace window.
   *
   * Set on a lifetime subscription too, far out, but nothing reads it — see
   * `isLifetime`. A date is kept rather than left null so every query, sort and
   * display that touches this field keeps working without a special case.
   */
  readonly renewsAt: Date;
  /** Set when payment is confirmed. Absent while `requested`. */
  readonly paidAt?: Date;
  /** What operations quotes on the phone, and what the payer puts in the reference. */
  readonly reference: string;
  readonly amount: Money;
  readonly term: Term;
  /**
   * True when this account has held a subscription before.
   *
   * Only franchise pricing reads it, where the first year costs more than
   * every year after. Stored on the record rather than inferred from dates,
   * because "have they paid us before" is a fact about the account and not
   * something to re-derive from whatever history happens to survive.
   */
  readonly renewal?: boolean;
}

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
      // Lifetime is the one term a date cannot end. Checked before the clock
      // so a stored renewsAt going stale can never take it away.
      if (isLifetime(subscription.term)) return true;
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
  if (isLifetime(subscription.term) && subscription.status === "active") return "active";
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
   Terms
   ------------------------------------------------------------------------- */

/**
 * How long somebody is buying, not what they are buying.
 *
 * Every role gets the same capabilities from any term — a farmer on one month
 * can do exactly what a farmer on lifetime can. What a longer term buys is a
 * lower effective monthly cost and a badge, and nothing else. Tiering the
 * *features* would mean a farmer who paid less cannot sell properly, which on a
 * marketplace means fewer listings, which is worse for everyone including the
 * platform.
 */
export const TERMS = ["m1", "m3", "m6", "y1", "y2", "y3", "lifetime"] as const;

export type Term = (typeof TERMS)[number];

export function isTerm(value: string): value is Term {
  return (TERMS as readonly string[]).includes(value);
}

export function isLifetime(term: Term): boolean {
  return term === "lifetime";
}

/**
 * A badge, earned by term.
 *
 * The visible half of the ladder. Somebody on a three-year plan has backed the
 * platform in a way a monthly subscriber has not, and a marketplace where the
 * other side of the trade can see that is a marketplace where it is worth
 * doing. Deliberately about commitment and never about trust — a Founder badge
 * says they paid, not that they are honest. Verification says that, and the two
 * must not be confusable.
 */
export interface Badge {
  readonly id: string;
  readonly label: string;
  /** Tailwind classes. Kept with the badge so every surface renders it alike. */
  readonly className: string;
}

export const BADGES: Record<Term, Badge> = {
  m1: { id: "member", label: "Member", className: "border-border text-muted-foreground" },
  m3: { id: "bronze", label: "Bronze", className: "border-[#a1662f]/40 text-[#a1662f]" },
  m6: { id: "silver", label: "Silver", className: "border-slate-400/50 text-slate-500" },
  y1: { id: "gold", label: "Gold", className: "border-amber-500/50 text-amber-600" },
  y2: { id: "platinum", label: "Platinum", className: "border-teal-500/50 text-teal-600" },
  y3: { id: "diamond", label: "Diamond", className: "border-sky-500/50 text-sky-600" },
  lifetime: {
    id: "founder",
    label: "Founder",
    className: "border-stone-500/60 bg-stone-500/10 text-stone-700 dark:text-stone-300",
  },
};

export function badgeFor(term: Term): Badge {
  return BADGES[term];
}

export interface TermOption {
  readonly term: Term;
  readonly label: string;
  /** Null for lifetime, which is the whole point of it. */
  readonly months: number | null;
  readonly price: Money;
  /** Marked in the interface as the one most people should take. */
  readonly recommended?: boolean;
  /** Rendered apart from the ladder, in its own colour. */
  readonly highlight?: boolean;
  readonly badge: Badge;
}

/**
 * The ladder everyone except a franchise pays.
 *
 * One price list for farmers, buyers, transport and manpower. They were priced
 * separately before, on the theory that a farmer and a buyer are different
 * customers — true, but the difference was not worth four price lists to
 * maintain and explain, and the cheap monthly entry point matters more to the
 * farmer than a discount would.
 *
 * A franchise is genuinely a different business and keeps its own list below.
 */
export const STANDARD_TERMS: readonly TermOption[] = [
  { term: "m1", label: "1 month", months: 1, price: rupees(199), badge: BADGES.m1 },
  { term: "m3", label: "3 months", months: 3, price: rupees(349), badge: BADGES.m3 },
  { term: "m6", label: "6 months", months: 6, price: rupees(599), badge: BADGES.m6 },
  {
    term: "y1",
    label: "1 year",
    months: 12,
    price: rupees(999),
    // The one most people should take: half the effective monthly cost of the
    // monthly plan, without asking for a commitment nobody can judge yet.
    recommended: true,
    badge: BADGES.y1,
  },
  { term: "y2", label: "2 years", months: 24, price: rupees(1499), badge: BADGES.y2 },
  { term: "y3", label: "3 years", months: 36, price: rupees(1999), badge: BADGES.y3 },
  {
    term: "lifetime",
    label: "Lifetime",
    months: null,
    price: rupees(4999),
    recommended: true,
    highlight: true,
    badge: BADGES.lifetime,
  },
];

/**
 * A franchise pays yearly, and the first year costs more.
 *
 * ₹1,25,000 to come on, ₹99,000 every year after. The gap is onboarding: a
 * franchise arrives with outlets to connect, staff to train and a district to
 * cover, and that work happens once. Charging it as a separate fee would be
 * more honest still, but a single number is what a franchise agreement is
 * negotiated against.
 */
export const FRANCHISE_FIRST_YEAR = rupees(125_000);
export const FRANCHISE_RENEWAL = rupees(99_000);

export function franchiseTerms(renewal: boolean): readonly TermOption[] {
  return [
    {
      term: "y1",
      label: renewal ? "1 year — renewal" : "1 year — first year",
      months: 12,
      price: renewal ? FRANCHISE_RENEWAL : FRANCHISE_FIRST_YEAR,
      recommended: true,
      badge: { id: "franchise", label: "Franchise Partner", className: BADGES.y1.className },
    },
  ];
}

/** The ladder this account sees, which depends on the role and their history. */
export function termsFor(role: Role, renewal = false): readonly TermOption[] {
  if (role === "admin") return [];
  return role === "franchise" ? franchiseTerms(renewal) : STANDARD_TERMS;
}

export function termOption(
  role: Role,
  term: Term,
  renewal = false,
): TermOption | undefined {
  return termsFor(role, renewal).find((t) => t.term === term);
}

/* ---- what a term works out at ---- */

/** Per month, in paise. Undefined for lifetime, which has no month to divide by. */
export function perMonth(option: TermOption): number | undefined {
  if (option.months === null) return undefined;
  return Math.round(option.price.minorUnits / option.months);
}

/**
 * How much cheaper per month than paying monthly, as a percentage.
 *
 * Against the one-month price, because that is the number somebody is deciding
 * against. Zero for the monthly term itself and for lifetime, which is not
 * comparable on a monthly basis and should be sold on being final instead.
 */
export function savingPercent(
  option: TermOption,
  baseline: readonly TermOption[] = STANDARD_TERMS,
): number {
  const monthly = baseline.find((t) => t.term === "m1")?.price.minorUnits;
  const rate = perMonth(option);
  if (!monthly || rate === undefined || option.term === "m1") return 0;
  return Math.max(0, Math.round(((monthly - rate) / monthly) * 100));
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
  option: TermOption,
  reference: string,
  now: Date,
  renewal = false,
): Subscription {
  return {
    planId: option.term,
    status: "requested",
    startedAt: now,
    renewsAt: endOf(option, now),
    reference,
    amount: option.price,
    term: option.term,
    renewal,
  };
}

/** When a term bought now would run to. Lifetime gets a date nobody reaches. */
function endOf(option: TermOption, from: Date): Date {
  if (option.months === null) return new Date(from.getTime() + LIFETIME_MS);
  return new Date(from.getTime() + option.months * MONTH_MS);
}

/**
 * A hundred years.
 *
 * Lifetime access is decided by the term, not by this date — `isSubscribed`
 * short-circuits on it. The date exists so that every sort, filter and "runs
 * to" label keeps working without each one needing to know about lifetime.
 */
const LIFETIME_MS = 100 * YEAR_MS;

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
    renewsAt: new Date(paidAt.getTime() + termMs(subscription.term)),
  };
}

/** How long a term lasts, in milliseconds. */
function termMs(term: Term): number {
  if (isLifetime(term)) return LIFETIME_MS;
  const months = STANDARD_TERMS.find((t) => t.term === term)?.months ?? 12;
  return months * MONTH_MS;
}

/** Renewal extends from the existing end date, so nobody loses days by paying early. */
export function renew(subscription: Subscription, paidAt: Date): Subscription {
  const from = Math.max(subscription.renewsAt.getTime(), paidAt.getTime());
  return {
    ...subscription,
    status: "active",
    paidAt,
    // Renewing marks the account as having paid before, which is what franchise
    // pricing turns on from the second year.
    renewal: true,
    renewsAt: new Date(from + termMs(subscription.term)),
  };
}

export const ZERO_MONEY = money(0);

/**
 * A plan id, in words somebody can read.
 *
 * The admin console was printing the stored id straight onto the screen — `m6`,
 * `y1`, `farmer-grower` — which is the name the database uses, not a name
 * anybody outside the code knows. "6 months · Silver" says the same thing to a
 * person who has never seen the schema.
 *
 * Handles three cases, and the third is the reason this exists rather than a
 * lookup table:
 *
 *  - A current term (`m6`) — the label and tier the pricing page already shows,
 *    so the console and the plan card cannot describe the same plan differently.
 *  - `lifetime` — named by its badge, because "Founder" is what it is called
 *    everywhere else.
 *  - Anything else — an older plan id like `farmer-grower` that predates the
 *    ladder and still sits on live accounts. Rather than showing a slug or
 *    hiding it behind "Unknown", the words are recovered from the id itself.
 *    An old plan is still somebody paying.
 */
export interface PlanDescription {
  /** What to call it. Never an id. */
  readonly title: string;
  /** The tier name, where the plan has one. */
  readonly tier?: string;
  /** True for a plan no longer sold, which is worth marking rather than hiding. */
  readonly retired: boolean;
}

export function describePlan(planId: string): PlanDescription {
  const known = STANDARD_TERMS.find((option) => option.term === planId);
  if (known) {
    return {
      title: known.label,
      tier: known.badge.label,
      retired: false,
    };
  }

  // `farmer-grower` → `Farmer grower`. Crude on purpose: inventing a prettier
  // name for a plan nobody sells any more would be inventing a fact.
  const words = planId
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

  return { title: words || "No plan", retired: true };
}
