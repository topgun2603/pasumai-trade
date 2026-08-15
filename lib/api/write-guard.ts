import "server-only";

import type { Role } from "@/lib/auth/claims";
import { verifySession, type Session } from "@/lib/auth/session";

/**
 * The gate on every write endpoint, in one place.
 *
 * These handlers write with Admin credentials, which bypass Security Rules
 * entirely. Until recently there was no way for them to know who was calling,
 * so they were closed in production outright. Now they ask.
 *
 * Returns either the session or the refusal to return. Callers write:
 *
 *     const gate = await requireRole("admin");
 *     if (!gate.ok) return gate.response;
 *     // gate.session is a verified operations user
 *
 * A single return value rather than a throw, because a route handler that
 * forgets a try/catch would leak a stack trace as a 500 and, worse, would have
 * run the write first.
 */

export type Gate =
  | { readonly ok: true; readonly session: Session }
  | { readonly ok: false; readonly response: Response };

/** 401 and 403 say different things, and the difference is useful. */
function unauthorized(): Response {
  return Response.json(
    { error: "Sign in to continue.", code: "signedOut" },
    { status: 401 },
  );
}

function forbidden(): Response {
  return Response.json(
    {
      error: "Your account does not have permission to do that.",
      code: "forbidden",
    },
    { status: 403 },
  );
}

/** Any signed-in user. */
export async function requireSession(): Promise<Gate> {
  const session = await verifySession();
  if (!session) return { ok: false, response: unauthorized() };
  return { ok: true, session };
}

/**
 * A signed-in user holding one of these roles.
 *
 * Operations is *not* implicitly allowed everywhere. It is listed where it
 * belongs, so reading a handler tells you who may call it without also knowing
 * a rule kept somewhere else.
 */
export async function requireRole(...roles: readonly Role[]): Promise<Gate> {
  const session = await verifySession();
  if (!session) return { ok: false, response: unauthorized() };
  if (!roles.includes(session.claims.role)) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, session };
}
