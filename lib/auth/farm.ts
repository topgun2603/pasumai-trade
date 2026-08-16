import "server-only";

import { notFound } from "next/navigation";

import type { FarmerAccount } from "@/lib/domain/admin";
import type { Check } from "@/lib/domain/kyc";
import { farmerJourney, type AccountFlags, type JourneyStep } from "@/lib/domain/readiness";
import type { Subscription } from "@/lib/domain/subscription";
import { readAccount } from "@/lib/firebase/account-flags";
import { readFarmer } from "@/lib/firebase/farmer-read";

import { requireConsole } from "./require";

/**
 * The signed-in farmer, and the boundary around them.
 *
 * Same shape as `requireAgency`, and deliberately a separate function rather
 * than a shared one behind a role switch: a farmer is one person, an agency is
 * a firm with staff, and the day those diverge the split already exists.
 *
 * Everything the farm console renders is filtered by the id in the session.
 * There is no code path that takes a farmer id from the URL, which is the
 * whole isolation story — one farmer cannot ask for another's listings because
 * there is nowhere to put the request.
 *
 * The flags and the journey come back with the session because every page in
 * this console needs at least one of them, and working them out per page meant
 * the same document read three times on one render.
 */
export interface FarmSession {
  readonly farmer: FarmerAccount;
  readonly email?: string;
  readonly subscription: Subscription | null;
  readonly checks: Check[];
  readonly flags: AccountFlags;
  readonly journey: JourneyStep[];
  /** Operations rejected or suspended this account. */
  readonly blocked: boolean;
}

export async function requireFarmer(): Promise<FarmSession> {
  // Operations are not admitted. Unlike the buyer console — where they need to
  // see what a buyer sees when one phones — a farmer's console holds one
  // person's private prices and bank tail, and there is a read-only view of all
  // of it in /admin already.
  const session = await requireConsole(["farmer"]);
  const now = new Date();

  // From Firestore, not the mock catalogue. Self-signup writes there and
  // nowhere else, so a lookup in the mocks refused every real farmer their own
  // console while the seeded demo accounts worked.
  const [farmer, account] = await Promise.all([
    readFarmer(session.claims.accountId ?? ""),
    readAccount("farmer", session.claims.accountId, now),
  ]);

  // A claim pointing at no farmer. Not found rather than an empty console: an
  // empty console reads as "you have nothing", which is a different and much
  // more alarming thing to tell someone about their own account.
  if (!farmer) notFound();

  return {
    farmer,
    email: session.email,
    subscription: account.subscription,
    checks: account.checks,
    flags: account.flags,
    journey: farmerJourney(account.flags),
    blocked: account.flags.blocked,
  };
}
