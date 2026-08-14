import type { Grade, QuantityUnit } from "./enums";
import { money, type Money } from "./money";
import type { BuyerOrderStatus } from "./order-state";

/**
 * A buyer's order.
 *
 * The important property of an order line is that it is a **snapshot**, not a
 * reference to live stock. Produce prices move through the day and shelf life
 * runs down continuously; an order has to remember the crop, grade, quantity
 * and price that were actually agreed, or a buyer's invoice would quietly
 * change after they placed it.
 *
 * One order is one collection point, because one order is one dispatch. A
 * cart spanning two points becomes two orders at checkout.
 */
export interface OrderLine {
  readonly produceId: string;
  /** Name as it stood when the order was placed. */
  readonly produceName: string;
  readonly emoji: string;
  readonly grade: Grade;
  readonly unit: QuantityUnit;
  readonly quantity: number;
  /** Per unit, in minor units, at the moment of ordering. */
  readonly unitPrice: number;
}

export function lineTotal(line: OrderLine): Money {
  return money(Math.round(line.unitPrice * line.quantity));
}

export interface BuyerOrder {
  readonly id: string;
  /** Short and human-quotable — what someone reads out on the phone. */
  readonly reference: string;
  readonly status: BuyerOrderStatus;
  readonly placedAt: Date;
  readonly buyerName: string;
  /**
   * One order is one district run. Produce is collected at the farm, so the
   * vehicle calls at each village in `stops` rather than at a single depot.
   */
  readonly districtId: string;
  readonly district: string;
  readonly stops: readonly string[];
  /** To the nearest farm on the run. */
  readonly distanceKm: number;
  readonly lines: readonly OrderLine[];
  /** Captured at placement — no credit is extended. */
  readonly paidAt?: Date;
  readonly vehicleRegistration?: string;
  readonly driverName?: string;
  readonly expectedArrival?: Date;
  readonly deliveredAt?: Date;
  /** Set when operations refunds rather than cancels. */
  readonly refundedAt?: Date;
}

export function orderTotal(order: BuyerOrder): Money {
  return money(
    order.lines.reduce((total, line) => total + lineTotal(line).minorUnits, 0),
  );
}

export function orderQuantity(order: BuyerOrder): number {
  return order.lines.reduce((total, line) => total + line.quantity, 0);
}

/** Orders sitting on an operations action rather than waiting on someone else. */
export function needsAllocation(order: BuyerOrder): boolean {
  return order.status === "paid";
}

export function isOpen(order: BuyerOrder): boolean {
  return (
    order.status !== "completed" &&
    order.status !== "cancelled" &&
    order.status !== "refunded"
  );
}

/**
 * How far along the order is, for a progress indicator.
 *
 * Terminal states return 1 so a completed order reads as finished rather than
 * as stalled at whatever step it stopped on.
 */
export function orderProgress(status: BuyerOrderStatus): number {
  const order: BuyerOrderStatus[] = [
    "pendingPayment",
    "paid",
    "allocated",
    "inTransit",
    "delivered",
    "completed",
  ];
  const index = order.indexOf(status);
  if (index === -1) return 1;
  return index / (order.length - 1);
}
