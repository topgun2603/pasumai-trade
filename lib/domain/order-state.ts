/**
 * Order lifecycles and the rules that gate them.
 *
 * There are two order documents, not one, and conflating them is the mistake
 * this module exists to prevent:
 *
 *  - A **procurement order** is the farmer's sale. It runs from an accepted
 *    offer through pickup, grading and settlement, and its price is not final
 *    until produce is physically graded at the farm gate.
 *
 *  - A **buyer order** is a purchase from the catalogue. It is paid in full at
 *    placement — no credit is extended — and runs through allocation, dispatch
 *    and delivery.
 *
 * They meet at the collection point: stock procured from farmers is graded,
 * pooled into SKUs, and sold on. Linking them is the job of allocation, not of
 * either state machine.
 *
 * Every transition is declared here rather than being written inline at each
 * call site. A route handler asks whether a move is permitted and is told why
 * not; it does not re-implement the rule. Guards **fail closed** — if the
 * context needed to check a rule is absent, the transition is refused. These
 * gates stand between produce and money, so "unknown" must never mean "yes".
 */
import {
  canTransact,
  DOCUMENT_LABELS,
  expiryState,
  type BuyerAccount,
  type DriverAccount,
  type Vehicle,
} from "./admin";
import type { OrderStatus } from "./enums";

/* -------------------------------------------------------------------------
   Actors and results
   ------------------------------------------------------------------------- */

export type Actor =
  | "farmer"
  | "buyer"
  | "franchise"
  | "driver"
  | "platform"
  /** Automated, e.g. a payment webhook. Never a person. */
  | "system";

export type RefusalCode =
  | "wrongState"
  | "notPermitted"
  | "terminal"
  | "buyerNotVerified"
  | "vehicleNotDispatchable"
  | "driverNotDispatchable"
  | "gradeDisputed"
  | "handoverCodeMismatch"
  | "paymentNotCaptured"
  | "missingContext";

export interface Refusal {
  readonly code: RefusalCode;
  /** Written to be shown to the person who attempted it. */
  readonly message: string;
}

export type TransitionResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly refusal: Refusal };

const ALLOWED: TransitionResult = { allowed: true };

function refuse(code: RefusalCode, message: string): TransitionResult {
  return { allowed: false, refusal: { code, message } };
}

/* -------------------------------------------------------------------------
   Shared guards
   ------------------------------------------------------------------------- */

/**
 * Context a guard may consult. Every field is optional so a caller can pass
 * only what a given transition needs — but a guard that requires a field it
 * was not given refuses rather than assuming.
 */
export interface TransitionContext {
  readonly now: number;
  readonly buyer?: BuyerAccount;
  readonly vehicle?: Vehicle;
  readonly driver?: DriverAccount;
  /** Code issued with the order. */
  readonly handoverCode?: string;
  /** Code the driver typed at the farm gate. */
  readonly providedCode?: string;
  readonly gradeDisputed?: boolean;
  readonly paymentCaptured?: boolean;
}

type Guard = (context: TransitionContext) => TransitionResult;

/**
 * A vehicle may carry a load only while every certificate is in date.
 *
 * Not a paperwork nicety: a lapsed policy means the produce on board is
 * uninsured, and the platform arranged the movement.
 */
export function vehicleDispatchable(
  vehicle: Vehicle,
  now: number,
): TransitionResult {
  if (!canTransact(vehicle.status)) {
    return refuse(
      "vehicleNotDispatchable",
      `${vehicle.registration} is ${vehicle.status} and cannot be dispatched.`,
    );
  }

  const lapsed = vehicle.documents.filter(
    (d) => expiryState(d, now) === "expired",
  );

  if (lapsed.length > 0) {
    // Document labels, not enum keys — this message is read by an operator
    // deciding whether to phone someone, so `drivingLicence` is not good
    // enough. The sentence is shaped so a label can lead without a
    // capitalisation problem ("RC" must not be lowercased).
    return refuse(
      "vehicleNotDispatchable",
      `${vehicle.registration} cannot be dispatched — expired: ${lapsed
        .map((d) => DOCUMENT_LABELS[d.kind])
        .join(", ")}. Any load it carries is uninsured.`,
    );
  }

  if (vehicle.documents.length === 0) {
    return refuse(
      "vehicleNotDispatchable",
      `${vehicle.registration} has no documents on file.`,
    );
  }

  return ALLOWED;
}

export function driverDispatchable(
  driver: DriverAccount,
  now: number,
): TransitionResult {
  if (!canTransact(driver.status)) {
    return refuse(
      "driverNotDispatchable",
      `${driver.name} is ${driver.status} and cannot be dispatched.`,
    );
  }

  const lapsed = driver.documents.filter(
    (d) => expiryState(d, now) === "expired",
  );

  if (lapsed.length > 0) {
    return refuse(
      "driverNotDispatchable",
      `${driver.name} cannot be dispatched — expired: ${lapsed
        .map((d) => DOCUMENT_LABELS[d.kind])
        .join(", ")}.`,
    );
  }

  const hasLicence = driver.documents.some((d) => d.kind === "drivingLicence");
  if (!hasLicence) {
    return refuse(
      "driverNotDispatchable",
      `${driver.name} has no driving licence on file.`,
    );
  }

  return ALLOWED;
}

/** Only a verified account may place an order. */
export function buyerMayOrder(account: BuyerAccount): TransitionResult {
  if (!canTransact(account.status)) {
    return refuse(
      "buyerNotVerified",
      `${account.name} is ${account.status} and cannot place orders.`,
    );
  }
  return ALLOWED;
}

const requireVehicle: Guard = (context) => {
  if (!context.vehicle) {
    return refuse("missingContext", "No vehicle was supplied for dispatch.");
  }
  return vehicleDispatchable(context.vehicle, context.now);
};

const requireDriver: Guard = (context) => {
  if (!context.driver) {
    return refuse("missingContext", "No driver was supplied for dispatch.");
  }
  return driverDispatchable(context.driver, context.now);
};

/**
 * The four-digit code the farmer reads out at handover.
 *
 * Compared as trimmed strings — leading zeros are significant, so this must
 * never become a numeric comparison.
 */
const requireHandoverCode: Guard = (context) => {
  if (!context.handoverCode || !context.providedCode) {
    return refuse("missingContext", "No handover code was supplied.");
  }
  return context.handoverCode.trim() === context.providedCode.trim()
    ? ALLOWED
    : refuse(
        "handoverCodeMismatch",
        "The handover code does not match the one issued with this order.",
      );
};

/**
 * A disputed grade holds the order at `graded`.
 *
 * The farmer is contesting the price, and moving the produce would settle the
 * argument in the buyer's favour by default.
 */
const requireGradeNotDisputed: Guard = (context) =>
  context.gradeDisputed
    ? refuse(
        "gradeDisputed",
        "The farmer has disputed the recorded grade. Resolve it before the load moves.",
      )
    : ALLOWED;

const requirePaymentCaptured: Guard = (context) =>
  context.paymentCaptured === true
    ? ALLOWED
    : refuse(
        "paymentNotCaptured",
        "Payment has not been confirmed by the aggregator.",
      );

/* -------------------------------------------------------------------------
   Procurement orders — the farmer's sale
   ------------------------------------------------------------------------- */

interface Transition<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly actors: readonly Actor[];
  readonly guards: readonly Guard[];
}

/** States a procurement order may be cancelled from. Never after delivery. */
const CANCELLABLE: readonly OrderStatus[] = [
  "confirmed",
  "ready",
  "driverAssigned",
  "atPickup",
  "graded",
];

export const PROCUREMENT_TRANSITIONS: readonly Transition<OrderStatus>[] = [
  {
    from: "confirmed",
    to: "ready",
    actors: ["farmer"],
    guards: [],
  },
  {
    // The only place vehicle and driver compliance is checked. Everything
    // downstream assumes a legal combination is already on the road.
    from: "ready",
    to: "driverAssigned",
    actors: ["platform", "franchise"],
    guards: [requireVehicle, requireDriver],
  },
  {
    from: "driverAssigned",
    to: "atPickup",
    actors: ["driver"],
    guards: [],
  },
  {
    from: "atPickup",
    to: "graded",
    actors: ["driver", "franchise"],
    guards: [requireHandoverCode],
  },
  {
    from: "graded",
    to: "inTransit",
    actors: ["farmer", "platform"],
    guards: [requireGradeNotDisputed],
  },
  {
    from: "inTransit",
    to: "delivered",
    actors: ["buyer", "franchise"],
    guards: [],
  },
  {
    // Settlement. Escrow releases to the farmer only once the buyer has
    // confirmed receipt — never on the platform's own view of progress.
    from: "delivered",
    to: "paid",
    actors: ["platform"],
    guards: [],
  },
  ...CANCELLABLE.map((from) => ({
    from,
    to: "cancelled" as OrderStatus,
    actors: ["platform", "franchise", "farmer"] as readonly Actor[],
    guards: [] as readonly Guard[],
  })),
];

export const PROCUREMENT_TERMINAL: readonly OrderStatus[] = ["paid", "cancelled"];

/* -------------------------------------------------------------------------
   Buyer orders — a catalogue purchase
   ------------------------------------------------------------------------- */

export type BuyerOrderStatus =
  /** Created, awaiting confirmation from the payment aggregator. */
  | "pendingPayment"
  /** Funds captured and held. No credit is extended, so this always precedes work. */
  | "paid"
  /** Stock reserved at the farms; vehicle and driver assigned to the run. */
  | "allocated"
  | "inTransit"
  /** Buyer has confirmed receipt. */
  | "delivered"
  /** Escrow released to suppliers and the order closed. */
  | "completed"
  | "cancelled"
  | "refunded";

export const BUYER_ORDER_LABELS: Record<BuyerOrderStatus, string> = {
  pendingPayment: "Awaiting payment",
  paid: "Paid",
  allocated: "Allocated",
  inTransit: "In transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const BUYER_ORDER_TRANSITIONS: readonly Transition<BuyerOrderStatus>[] = [
  {
    from: "pendingPayment",
    to: "paid",
    // A webhook, never a person — nobody marks an order paid by hand.
    actors: ["system"],
    guards: [requirePaymentCaptured],
  },
  {
    from: "pendingPayment",
    to: "cancelled",
    actors: ["buyer", "platform"],
    guards: [],
  },
  {
    from: "paid",
    to: "allocated",
    actors: ["platform", "franchise"],
    guards: [requireVehicle, requireDriver],
  },
  {
    // Cancelling after payment is a refund, not a cancellation — the
    // distinction is what the ledger records.
    from: "paid",
    to: "refunded",
    actors: ["platform"],
    guards: [],
  },
  {
    from: "allocated",
    to: "inTransit",
    actors: ["driver", "platform"],
    guards: [],
  },
  {
    from: "allocated",
    to: "refunded",
    actors: ["platform"],
    guards: [],
  },
  {
    from: "inTransit",
    to: "delivered",
    actors: ["buyer"],
    guards: [],
  },
  {
    from: "delivered",
    to: "completed",
    actors: ["platform"],
    guards: [],
  },
];

export const BUYER_ORDER_TERMINAL: readonly BuyerOrderStatus[] = [
  "completed",
  "cancelled",
  "refunded",
];

/* -------------------------------------------------------------------------
   Evaluation
   ------------------------------------------------------------------------- */

function evaluate<S extends string>(
  table: readonly Transition<S>[],
  terminal: readonly S[],
  from: S,
  to: S,
  actor: Actor,
  context: TransitionContext,
): TransitionResult {
  if (terminal.includes(from)) {
    return refuse("terminal", `An order that is ${from} cannot change state.`);
  }

  const candidates = table.filter((t) => t.from === from && t.to === to);

  if (candidates.length === 0) {
    return refuse("wrongState", `An order cannot move from ${from} to ${to}.`);
  }

  const permitted = candidates.filter((t) => t.actors.includes(actor));

  if (permitted.length === 0) {
    return refuse(
      "notPermitted",
      `A ${actor} may not move an order from ${from} to ${to}.`,
    );
  }

  for (const transition of permitted) {
    for (const guard of transition.guards) {
      const result = guard(context);
      if (!result.allowed) return result;
    }
  }

  return ALLOWED;
}

export function canAdvanceProcurement(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
  context: TransitionContext,
): TransitionResult {
  return evaluate(
    PROCUREMENT_TRANSITIONS,
    PROCUREMENT_TERMINAL,
    from,
    to,
    actor,
    context,
  );
}

export function canAdvanceBuyerOrder(
  from: BuyerOrderStatus,
  to: BuyerOrderStatus,
  actor: Actor,
  context: TransitionContext,
): TransitionResult {
  return evaluate(
    BUYER_ORDER_TRANSITIONS,
    BUYER_ORDER_TERMINAL,
    from,
    to,
    actor,
    context,
  );
}

/** Every state reachable from `from`, ignoring guards. For building UI. */
export function nextProcurementStates(from: OrderStatus): OrderStatus[] {
  return PROCUREMENT_TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

export function nextBuyerOrderStates(
  from: BuyerOrderStatus,
): BuyerOrderStatus[] {
  return BUYER_ORDER_TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

/**
 * Throws unless the move is permitted.
 *
 * For route handlers, where a refusal is an error response rather than a
 * branch. The refusal code travels on the error so the handler can map it to
 * a status without re-deriving the reason.
 */
export class TransitionError extends Error {
  readonly code: RefusalCode;

  constructor(refusal: Refusal) {
    super(refusal.message);
    this.name = "TransitionError";
    this.code = refusal.code;
  }
}

export function assertProcurement(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
  context: TransitionContext,
): void {
  const result = canAdvanceProcurement(from, to, actor, context);
  if (!result.allowed) throw new TransitionError(result.refusal);
}

export function assertBuyerOrder(
  from: BuyerOrderStatus,
  to: BuyerOrderStatus,
  actor: Actor,
  context: TransitionContext,
): void {
  const result = canAdvanceBuyerOrder(from, to, actor, context);
  if (!result.allowed) throw new TransitionError(result.refusal);
}
