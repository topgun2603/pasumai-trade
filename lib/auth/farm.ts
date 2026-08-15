import "server-only";

import { notFound } from "next/navigation";

import type { FarmerAccount } from "@/lib/domain/admin";
import { farmerAccounts } from "@/lib/mock/admin";
import { readAccountState } from "@/lib/firebase/subscription-read";
import type { Subscription } from "@/lib/domain/subscription";

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
 */
export interface FarmSession {
  readonly farmer: FarmerAccount;
  readonly email?: string;
  readonly subscription: Subscription | null;
  /** Operations rejected or suspended this account. */
  readonly blocked: boolean;
}

export async function requireFarmer(): Promise<FarmSession> {
  // Operations are not admitted. Unlike the buyer console — where they need to
  // see what a buyer sees when one phones — a farmer's console holds one
  // person's private prices and bank tail, and there is a read-only view of all
  // of it in /admin already.
  const session = await requireConsole(["farmer"]);

  const farmer = farmerAccounts(new Date()).find(
    (f) => f.id === session.claims.accountId,
  );

  // A claim pointing at no farmer. Not found rather than an empty console: an
  // empty console reads as "you have nothing", which is a different and much
  // more alarming thing to tell someone about their own account.
  if (!farmer) notFound();

  const state = await readAccountState("farmer", session.claims.accountId);

  return {
    farmer,
    email: session.email,
    subscription: state.subscription,
    blocked: state.blocked,
  };
}
