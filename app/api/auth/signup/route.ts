import { validateCredentials, type SignupCredentials } from "@/lib/domain/signup";
import { adminAuth, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Open a login. Nothing more.
 *
 * The only unauthenticated write endpoint on the platform, which is why it is
 * written more defensively than the rest.
 *
 * ## What it deliberately no longer does
 *
 * It used to take a name, a mobile number and a full address, write an account
 * document, and set the role and account id as claims — all before the person
 * had proved anything or had any reason to trust the form. It now creates a
 * Firebase user and stops.
 *
 * Everything else is asked once the login exists, at the profile step every
 * console is gated on (`lib/auth/require.ts`). Three things fall out of that:
 * a registration abandoned halfway leaves a login somebody can come back to
 * rather than nothing; the email-and-password door and the OTP door now
 * converge on one place that creates accounts instead of two that must agree;
 * and this endpoint can no longer mint a role, because it does not set claims
 * at all.
 *
 * A user created here has **no claims**, so the session it produces reaches
 * exactly one endpoint — the one that turns it into an account.
 *
 * What it still lacks is rate limiting. There is no shared store to hold a
 * counter, and an in-memory one on serverless resets per instance and would
 * read as protection without being any. The real fix is App Check or a limit at
 * the edge. Until then this can be used to create junk logins — which now carry
 * no account and no role, so the cost is a list of unusable users rather than
 * queue noise for operations.
 */

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json(
      { error: "Registration is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const values: SignupCredentials = {
    email: typeof body.email === "string" ? body.email.trim().slice(0, 200).toLowerCase() : "",
    // Not trimmed and not normalised: a passphrase is whatever they typed, and
    // silently altering it means it will not match at sign-in.
    password: typeof body.password === "string" ? body.password : "",
  };

  // The same function the form runs, so a field cannot be valid in the browser
  // and invalid here or the other way round.
  const errors = validateCredentials(values);
  const failed = Object.entries(errors).filter(([, message]) => message);
  if (failed.length > 0) {
    return Response.json(
      { error: "Check the highlighted fields.", fields: Object.fromEntries(failed) },
      { status: 422 },
    );
  }

  try {
    await adminAuth().createUser({
      email: values.email,
      password: values.password,
      emailVerified: false,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";

    if (code === "auth/email-already-exists") {
      // Said at the field rather than as a general failure, because the fix is
      // to sign in instead and only that field is wrong.
      return Response.json(
        {
          error: "That email already has a login.",
          fields: { email: "Already registered — sign in instead" },
        },
        { status: 409 },
      );
    }

    return Response.json({ error: "Could not create the login." }, { status: 500 });
  }

  /*
    No account id to return, because no account exists yet. The browser signs in
    with these credentials, asks Firebase to send the verification email, and
    goes to the profile step — where the account is created and the claims set.
  */
  return Response.json({ created: true }, { status: 201 });
}
