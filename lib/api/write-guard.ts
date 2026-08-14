import "server-only";

/**
 * The gate on every write endpoint, in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THERE IS NO AUTHENTICATION YET.
 *
 *  Security Rules deny every client write, so mutations have to come through a
 *  route handler holding Admin credentials — and the Admin SDK bypasses rules
 *  entirely. Until Firebase Auth and session cookies exist, these handlers
 *  cannot tell who is calling. An unauthenticated endpoint writing with Admin
 *  credentials is a hole, not a feature, so it is closed in production.
 *
 *  When auth lands, this function becomes:
 *
 *      const session = await verifySession();
 *      if (!session) return unauthorized();
 *      if (session.role !== "admin") return forbidden();
 *
 *  and both the environment check and the escape hatch below are deleted.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `UNSAFE_ALLOW_UNAUTHENTICATED_WRITES` opens the endpoints in production.
 *
 * It is named so that nobody sets it without knowing what they are doing, and
 * it is only defensible when something *else* is doing the authenticating —
 * in practice, Vercel Deployment Protection, which requires a team login or a
 * password before any request reaches the app at all. With that on, the
 * platform is the gate and this flag lets a real deployment be used for
 * demonstration and operations.
 *
 * With it off — a publicly reachable deployment — anyone who finds the URL can
 * rewrite the crop catalogue, retitle villages, and accept a price on a
 * farmer's behalf. Do not set it on a public deployment.
 */
export function writeGuard(): Response | null {
  if (process.env.NODE_ENV !== "production") return null;

  if (process.env.UNSAFE_ALLOW_UNAUTHENTICATED_WRITES === "true") return null;

  // JSON rather than a bare 404 body: the consoles read `error` from the
  // response and show it. A plain-text 404 left the bargaining screen saying
  // "Server returned 404.", which tells the person nothing about why.
  return Response.json(
    {
      error:
        "Editing is disabled on this deployment. The write endpoints hold Admin credentials and cannot yet tell who is calling, so they are closed until authentication is connected.",
      code: "writesDisabled",
    },
    { status: 404 },
  );
}

/** Whether a write would be accepted, for rendering the console read-only. */
export function writesEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.UNSAFE_ALLOW_UNAUTHENTICATED_WRITES === "true"
  );
}
