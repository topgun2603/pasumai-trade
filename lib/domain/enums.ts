/**
 * Domain enumerations, ported from packages/core/lib/src/domain/enums.dart.
 *
 * Modelled as string-literal unions with lookup tables rather than TypeScript
 * `enum`s: the values cross the wire and the RSC boundary, and a string union
 * serialises to exactly what the OpenAPI contract already specifies.
 */

/** Quantity units a farmer lists in. */
export const QUANTITY_UNITS = {
  kg: { en: "kg", ta: "கிலோ" },
  quintal: { en: "quintal", ta: "குவிண்டால்" },
  tonne: { en: "tonne", ta: "டன்" },
  crate: { en: "crate", ta: "கிரேட்" },
  bag: { en: "bag", ta: "மூட்டை" },
} as const;

export type QuantityUnit = keyof typeof QUANTITY_UNITS;

export function unitLabel(unit: QuantityUnit, locale: string = "en"): string {
  return locale === "ta" ? QUANTITY_UNITS[unit].ta : QUANTITY_UNITS[unit].en;
}

/**
 * Quality grade.
 *
 * Set by the franchise at pickup with the farmer present — never
 * self-declared at listing time. All three grade prices are agreed up front in
 * the offer, so inspection resolves the price rather than reopening the
 * negotiation at the roadside.
 */
export const GRADES = ["a", "b", "c"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS: Record<Grade, string> = {
  a: "A",
  b: "B",
  c: "C",
};

/** Where a listing has got to. */
export type ListingStatus =
  /** Visible to the franchise, no offer yet. */
  | "awaitingOffer"
  /** Franchise has quoted; the farmer must respond before it expires. */
  | "offered"
  /** Farmer accepted; an order exists. */
  | "accepted"
  /** Farmer declined, or the offer expired. */
  | "closed";

/**
 * The farmer's view of an order.
 *
 * A deliberate reduction of the platform's internal trip lifecycle: the farmer
 * does not need `ASSIGNED` and `ACCEPTED` as separate states, and `COMPLETED`
 * is a settlement concern they see as "paid" on the money screen.
 */
export type OrderStatus =
  | "confirmed"
  | "ready"
  | "driverAssigned"
  | "atPickup"
  | "graded"
  | "inTransit"
  | "delivered"
  | "paid"
  | "cancelled";

export function isActive(status: OrderStatus): boolean {
  return status !== "paid" && status !== "cancelled";
}

/** Whether the farmer has something to do right now. */
export function needsFarmerAction(status: OrderStatus): boolean {
  return status === "confirmed" || status === "atPickup" || status === "graded";
}

/** How money is sitting for a given order. */
export type PaymentStatus =
  /** Buyer's funds captured, held by the licensed aggregator, not yet the farmer's. */
  | "inEscrow"
  /** Released from escrow, on its way to the farmer's bank. */
  | "releasing"
  /** Landed in the farmer's account. */
  | "paid";

/**
 * When the farmer wants the vehicle.
 *
 * Three fixed windows rather than a date-time picker — this covers essentially
 * every real case and removes a control that is miserable to operate on a
 * budget phone in a field.
 */
export type PickupWindow = "now" | "thisEvening" | "tomorrowMorning";

export const PICKUP_WINDOW_LABELS: Record<PickupWindow, string> = {
  now: "Now",
  thisEvening: "This evening",
  tomorrowMorning: "Tomorrow morning",
};
