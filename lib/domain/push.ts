/**
 * Push notifications, and when not to send one.
 *
 * A notification in the bell is something you find when you look. A push is
 * something that interrupts you, and the two should not be the same set — a
 * farmer who gets a buzz for every message in every bargain turns them off
 * within a day, and then misses the one that mattered. Nobody re-enables
 * notifications they have already learned to distrust.
 *
 * So this decides, per kind, whether the event is worth a phone lighting up.
 * The rule of thumb: push what somebody would want to be interrupted for, in
 * the middle of something else, out in a field.
 */
import type { NotificationKind } from "./notification";

/**
 * Kinds that earn an interruption.
 *
 * Money and movement, roughly. An offer arriving is worth knowing about
 * because produce spoils and buyers move on; a price settling is worth knowing
 * because it changes what happens tomorrow morning; a lorry being arranged is
 * worth knowing because somebody has to be there when it comes.
 *
 * Left out on purpose:
 *
 *  - `bargainMessage` — the vocabulary is thirty sentences about collection
 *    times. Useful in the thread, not worth a buzz.
 *  - `produceListed` — a buyer covering three districts would be pushed several
 *    times a morning, which is how a notification channel gets muted.
 *  - `bargainCountered` — the counter matters, but it arrives while somebody is
 *    already bargaining and watching the screen. The bell is enough.
 */
const PUSHABLE: readonly NotificationKind[] = [
  // Verification blocks everything else on the platform, and somebody waiting
  // on an approval is checking the app for it. Being told beats being checked
  // on.
  "checkRejected",
  "checkNeedsInfo",
  "checkNeedsReupload",
  "accountVerified",
  "bargainOpened",
  "bargainAgreed",
  "bargainClosed",
  "orderPlaced",
  "transportArranged",
];

export function isPushable(kind: NotificationKind): boolean {
  return PUSHABLE.includes(kind);
}

/**
 * A device registration.
 *
 * Tokens are per browser and per device, not per person: one farmer signing in
 * on a phone and a laptop has two, and both should buzz. They also rot — a
 * browser reissues them, a device is wiped — so every send prunes the ones the
 * service reports as gone rather than accumulating dead rows forever.
 */
export interface PushToken {
  readonly token: string;
  readonly accountId: string;
  /** So somebody can tell which device to un-register. */
  readonly label?: string;
  readonly createdAt: Date;
  readonly lastSeenAt?: Date;
}

/** Errors from the messaging service that mean the token is dead, not that we failed. */
const DEAD = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export function isDeadToken(code: string | undefined): boolean {
  return code !== undefined && DEAD.has(code);
}

/**
 * A token, shortened for a document id.
 *
 * FCM tokens run to about 160 characters, which is inside Firestore's 1500-byte
 * limit — but they also contain `/`, which is a path separator and cannot
 * appear in a document id at all. Encoded rather than hashed so the id can
 * still be turned back into the token it names.
 */
export function tokenId(token: string): string {
  return token.replace(/\//g, "_").replace(/\+/g, "-").slice(0, 200);
}
