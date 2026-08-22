import "server-only";

import { redirect } from "next/navigation";

import { hasAdminCredentials } from "@/lib/firebase/admin";

import { HOME_FOR_ROLE, type Role } from "./claims";
import { readPendingSession, verifySession, type Session } from "./session";

/**
 * The gate on a console layout.
 *
 * Layouts, not pages: a check on every page is a check somebody forgets on the
 * page they add next week. Putting it on the layout means a new route under
 * `(admin)` or `(franchise)` is protected the moment it exists.
 *
 * A layout cannot return a 401 — there is nobody to read it — so this redirects
 * to sign-in instead, carrying where the person was headed so they land there
 * afterwards rather than on a generic home page.
 *
 * This is defence in depth, not the only defence. Every write endpoint checks
 * the session again for itself, because a route handler is reachable directly
 * and never renders through a layout at all.
 */
export async function requireConsole(roles: readonly Role[]): Promise<Session> {
  // Nothing can be verified without Admin credentials, and pretending
  // otherwise would leave the console open on a misconfigured deployment. Fail
  // closed, and say which it is.
  if (!hasAdminCredentials()) {
    redirect("/en/signin?error=unconfigured");
  }

  const session = await verifySession();
  if (!session) {
    /*
      A cookie with no claims means the profile step is unfinished.

      `verifySession` returns null for a session without a role, so a genuine
      signed-out visitor and somebody halfway through registering look identical
      to it. Told apart here, because sending an unfinished registration back to
      sign in loops them: they authenticate, arrive with no claims, and bounce
      again.

      This is also what makes the profile mandatory. Every console page goes
      through this guard, so there is nothing reachable between proving a
      handset and saying who you are.
    */
    const pending = await readPendingSession();
    redirect(pending ? "/profile" : "/en/signin");
  }

  if (!roles.includes(session.claims.role)) {
    // Signed in, but not for this console. Sent to their own rather than shown
    // a refusal they can do nothing about.
    //
    // The destination comes from the one table that knows where each role
    // lives; hardcoding "/market" sent an agency to a page that refused them
    // one redirect later. Every role now has a console, so there is no longer
    // a "nowhere to send you" branch — farmers have /farm.
    redirect(HOME_FOR_ROLE[session.claims.role]);
  }

  return session;
}
