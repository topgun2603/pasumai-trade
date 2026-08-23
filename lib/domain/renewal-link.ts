import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The renewal link that goes out in a lapsed subscriber's SMS.
 *
 * ## What this is not
 *
 * It is **not a way to sign in**. The obvious build is a magic link — tap it
 * and you are in, renewing in one step — and it is the wrong build here. An
 * SMS is forwarded, screenshotted, read off a lock screen and left in a shared
 * handset's message list. A link that authenticates turns every one of those
 * into somebody else's account, on a platform whose whole argument is that a
 * farmer and a buyer settle a price between themselves and each is who they
 * say they are.
 *
 * So the token says one thing only: *which account this message was about*. It
 * carries no session and grants nothing. Landing on it while signed out sends
 * the person to sign in exactly as any other console link would; landing on it
 * signed in as somebody else says so rather than quietly renewing the wrong
 * subscription.
 *
 * What it buys, then, is the difference between "your plan has ended" with a
 * bare address to type, and a tap that lands on the right renewal page for the
 * right role — which on a handset, for somebody who has not opened the app in
 * a fortnight, is most of the distance.
 *
 * ## Why it is signed at all, if it grants nothing
 *
 * Because it decides what page to render and which account to name on it. An
 * unsigned `?account=F-3E4ADB` is an invitation to walk the account space and
 * find out who exists. The signature makes the link unguessable and the expiry
 * stops one working a year later.
 */

/** A fortnight. Long enough to act on, short enough that a stale SMS is dead. */
export const RENEWAL_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface RenewalClaim {
  readonly accountId: string;
  /** Which console to send them to. */
  readonly collection: string;
  readonly expiresAt: number;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function payloadOf(claim: RenewalClaim): string {
  // Fixed order and a separator that cannot appear in an account id, so two
  // different claims cannot produce the same string to sign.
  return `${claim.accountId}:${claim.collection}:${claim.expiresAt}`;
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

/**
 * A token for one account, valid until it expires.
 *
 * The secret is the caller's to supply — the cron reads it from the
 * environment — so this stays a pure function and can be tested without one.
 */
export function renewalToken(claim: RenewalClaim, secret: string): string {
  return `${base64url(Buffer.from(payloadOf(claim)))}.${sign(payloadOf(claim), secret)}`;
}

export type RenewalCheck =
  | { readonly ok: true; readonly claim: RenewalClaim }
  | { readonly ok: false; readonly reason: "malformed" | "badSignature" | "expired" };

/**
 * Read a token back, refusing anything that is not exactly what we issued.
 *
 * The signature is compared in constant time. A byte-by-byte comparison that
 * returns early leaks, over enough attempts, how much of a guess was right —
 * which is the one attack a short signed string is actually exposed to.
 */
export function readRenewalToken(
  token: string,
  secret: string,
  now: number,
): RenewalCheck {
  const [encoded, offered] = token.split(".");
  if (!encoded || !offered) return { ok: false, reason: "malformed" };

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const parts = payload.split(":");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [accountId, collection, rawExpiry] = parts;
  const expiresAt = Number(rawExpiry);
  if (!accountId || !collection || !Number.isFinite(expiresAt)) {
    return { ok: false, reason: "malformed" };
  }

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(offered);
  // Length is checked first because `timingSafeEqual` throws on a mismatch —
  // and the length of a signature is not a secret.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "badSignature" };
  }

  // Signature before expiry, deliberately: an expired token that was never
  // ours should read as forged rather than as merely late.
  if (now >= expiresAt) return { ok: false, reason: "expired" };

  return { ok: true, claim: { accountId, collection, expiresAt } };
}

/** Where a valid token lands. Farmers have their own console. */
export function renewalDestination(collection: string): string {
  return collection === "farmers" ? "/farm/subscription" : "/subscription";
}
