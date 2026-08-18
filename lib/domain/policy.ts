/**
 * Numbers the platform runs on, gathered in one place.
 *
 * Everything here was a constant somewhere in the code. None of them are
 * *rules* — the rules stay compiled, tested and unchangeable. These are the
 * dials the rules read: how long a quote holds, when a document counts as
 * expiring, how thin a farmer pool has to be before it is worth a warning.
 *
 * They live together because they share a failure mode. Each is a decision
 * someone in operations makes, discovers is wrong two weeks later, and cannot
 * change without a developer. One document, one editor, one place to look when
 * a number on screen is not the number you expected.
 *
 * Defaults are the values the code used before this file existed, so a project
 * with no policy document behaves exactly as it did.
 */

export interface PlatformPolicy {
  /* Bargaining ---------------------------------------------------------- */

  /** How long a proposal stays acceptable. Was hardcoded at 120. */
  readonly proposalValidityMinutes: number;
  /**
   * Silence after which an open bargain is closed as expired.
   *
   * A thread nobody answers is worse than a refusal: the farmer holds stock
   * for a buyer who has moved on. Zero disables the sweep.
   */
  readonly bargainSilenceHours: number;

  /* Freshness ----------------------------------------------------------- */

  /**
   * Default shelf-life bands, in hours remaining. A crop that sets its own
   * overrides these — turmeric and mango cannot share a cutoff.
   */
  readonly endOfLifeHours: number;
  readonly useSoonHours: number;

  /* Compliance ---------------------------------------------------------- */

  /** Days before expiry that a document starts warning. Was 30. */
  readonly expiringSoonDays: number;

  /* Supply -------------------------------------------------------------- */

  /** Registered farmers below which a district is flagged thin. Was 30. */
  readonly thinSupplyFarmers: number;

  /* Subscriptions -------------------------------------------------------- */

  /*
    The reminder ladder, as three distances from the end.

    Numbers rather than a list, so they fit the one editor Controls already has
    and every value carries its own bounds. How far ahead to warn somebody is a
    commercial decision — an annual plan wants a month's notice, a monthly one
    would be nagging — so it belongs to operations rather than to a constant.

    Set any of them to 0 to switch that rung off.
  */
  readonly reminderFarDays: number;
  readonly reminderNearDays: number;
  readonly reminderLastDays: number;
  /**
   * Days after expiry to try once more.
   *
   * The rung most easily forgotten and the one that matters most: somebody who
   * has already lapsed is exactly who a pre-expiry reminder failed to reach.
   */
  readonly reminderLapsedDays: number;
  /** Fallback minimum order where a district sets none, in paise. */
  readonly defaultMinOrderValue: number;

  /* Distance ------------------------------------------------------------ */

  /**
   * How much longer the road is than the straight line, as a percentage.
   *
   * Distances are computed from coordinates, and great-circle is not road.
   * Across the Dharmapuri and Salem ghats the road runs about a third longer,
   * hence 130. Replace the whole estimate with a routing service when freight
   * is charged on this rather than estimated from it.
   */
  readonly roadFactorPercent: number;
}

export const DEFAULT_POLICY: PlatformPolicy = {
  proposalValidityMinutes: 120,
  bargainSilenceHours: 48,
  endOfLifeHours: 24,
  useSoonHours: 60,
  expiringSoonDays: 30,
  thinSupplyFarmers: 30,
  reminderFarDays: 14,
  reminderNearDays: 7,
  reminderLastDays: 1,
  reminderLapsedDays: 1,
  defaultMinOrderValue: 1_500_000,
  roadFactorPercent: 130,
};

/** The document every policy read lands on. One row, known id. */
export const POLICY_DOC_ID = "policy";

export interface PolicyField {
  readonly key: keyof PlatformPolicy;
  readonly label: string;
  readonly help: string;
  /** Shown after the input — `minutes`, `hours`, `days`. */
  readonly suffix: string;
  readonly min: number;
  readonly max: number;
  /** Held in paise, entered in rupees. */
  readonly money?: boolean;
  readonly group:
    | "Bargaining"
    | "Freshness"
    | "Compliance"
    | "Supply"
    | "Distance"
    | "Subscriptions";
}

/**
 * Bounds are deliberately wide but not unlimited.
 *
 * A typo that sets the expiry warning to 3000 days silences every compliance
 * alert on the platform, and nothing else would catch it — these values are
 * read, not validated, at every call site.
 */
export const POLICY_FIELDS: readonly PolicyField[] = [
  {
    key: "proposalValidityMinutes",
    label: "Proposal holds for",
    help: "How long a price stays acceptable once sent. Long enough for a farmer to think, short enough that a rate quoted this morning is not binding tonight.",
    suffix: "minutes",
    min: 5,
    max: 2880,
    group: "Bargaining",
  },
  {
    key: "bargainSilenceHours",
    label: "Close a silent bargain after",
    help: "An unanswered thread leaves the farmer holding stock for a buyer who has moved on. Set to 0 to leave threads open indefinitely.",
    suffix: "hours",
    min: 0,
    max: 720,
    group: "Bargaining",
  },
  {
    key: "endOfLifeHours",
    label: "Today only, under",
    help: "Stock at or below this is sellable today. It also decides which loads need a reefer — the dispatch guard refuses a plain truck inside this window.",
    suffix: "hours left",
    min: 1,
    max: 168,
    group: "Freshness",
  },
  {
    key: "useSoonHours",
    label: "Use soon, under",
    help: "The middle band. Must sit above the today-only figure.",
    suffix: "hours left",
    min: 2,
    max: 720,
    group: "Freshness",
  },
  {
    key: "expiringSoonDays",
    label: "Warn on documents expiring within",
    help: "Renewals in India routinely take weeks, so this wants to be generous. Too high and every document warns; too low and a lapse arrives unannounced.",
    suffix: "days",
    min: 1,
    max: 365,
    group: "Compliance",
  },
  {
    key: "thinSupplyFarmers",
    label: "Flag a district as thin under",
    help: "Registered farmers below which a district is a supply risk worth showing.",
    suffix: "farmers",
    min: 1,
    max: 1000,
    group: "Supply",
  },
  {
    key: "reminderFarDays",
    label: "First renewal reminder",
    help: "Days before a subscription ends that the first reminder goes out. 0 switches it off.",
    suffix: "days before",
    min: 0,
    max: 120,
    group: "Subscriptions",
  },
  {
    key: "reminderNearDays",
    label: "Second reminder",
    help: "The follow-up, closer to the end. Should be smaller than the first.",
    suffix: "days before",
    min: 0,
    max: 90,
    group: "Subscriptions",
  },
  {
    key: "reminderLastDays",
    label: "Final reminder",
    help: "The last warning before access stops.",
    suffix: "days before",
    min: 0,
    max: 30,
    group: "Subscriptions",
  },
  {
    key: "reminderLapsedDays",
    label: "Chase after it lapses",
    help: "Days after expiry to try once more. Somebody already locked out is exactly who the earlier reminders failed to reach.",
    suffix: "days after",
    min: 0,
    max: 60,
    group: "Subscriptions",
  },
  {
    key: "defaultMinOrderValue",
    label: "Default minimum order",
    help: "Used where a district sets no minimum of its own. A district's own figure always wins.",
    suffix: "₹",
    min: 0,
    max: 10_000_000,
    money: true,
    group: "Supply",
  },
  {
    key: "roadFactorPercent",
    label: "Roads run longer than straight line by",
    help: "Distances are computed from village coordinates, and the road is never the straight line. 130 means roads here run about 30% longer. Raise it for hill districts; drop it toward 100 only if you replace the estimate with real routing.",
    suffix: "%",
    min: 100,
    max: 250,
    group: "Distance",
  },
];

/**
 * Read a stored policy, falling back field by field.
 *
 * Per-field rather than all-or-nothing: a document written before a field
 * existed should adopt the default for that one field, not be discarded.
 */
export function readPolicy(data: Record<string, unknown> | undefined): PlatformPolicy {
  const out = { ...DEFAULT_POLICY };
  if (!data) return out;

  for (const field of POLICY_FIELDS) {
    const value = data[field.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      (out as Record<string, number>)[field.key] = value;
    }
  }
  return out;
}

/** Freshness bands for a crop, its own if set, otherwise the platform's. */
export function freshnessBands(
  policy: PlatformPolicy,
  shelfLifeHours?: number | null,
): { endOfLife: number; useSoon: number } {
  if (!shelfLifeHours || shelfLifeHours <= 0) {
    return { endOfLife: policy.endOfLifeHours, useSoon: policy.useSoonHours };
  }

  // Bands scale with the crop. A turmeric sack at 4000 hours of life is not
  // "use soon" because it has 60 hours left, and a mango with 20 hours left is
  // not fresh. Ten and twenty-five per cent of total life keeps the warning
  // proportionate to how long the crop was ever going to last.
  return {
    endOfLife: Math.max(1, Math.round(shelfLifeHours * 0.1)),
    useSoon: Math.max(2, Math.round(shelfLifeHours * 0.25)),
  };
}
