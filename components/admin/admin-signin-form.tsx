"use client";

import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { HOME_FOR_ROLE, ROLE_LABELS, isRole } from "@/lib/auth/claims";
import { signIn } from "@/lib/auth/sign-in";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The operations credential form.
 *
 * Deliberately narrower than the public one next door. That form offers six
 * doors, a Google button and an SMS code, because it serves farmers with a
 * handset and no email habit. This one offers an email and a password and
 * nothing else — operations accounts are issued internally, so the credential
 * is always an email and a password, and every extra route in is a route into
 * the console that has to be defended for no one's benefit.
 *
 * What it does *not* do is refuse a non-operations account. The password is
 * still correct, and pretending otherwise teaches nothing; whoever it belongs
 * to is sent to their own console with a line saying why. Refusing here would
 * also be theatre — the `(admin)` layout is what actually holds the door.
 */
export function AdminSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  /**
   * Land where the account is entitled to go, not where the door said.
   *
   * A full document load rather than a router push: the console reads the
   * session on the server, and a client-side navigation would render the new
   * page against a cache taken before the cookie existed.
   */
  function land(role: string | undefined) {
    if (role === "admin" || role === "franchise") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin");
      return;
    }

    if (isRole(role)) {
      // Not operations, but a real account. Say so before the page changes
      // under them, or arriving somewhere they did not ask for reads as a bug.
      toast.info(
        `Signed in as ${ROLE_LABELS[role]}. Taking you to your console.`,
      );
      const destination = HOME_FOR_ROLE[role];
      window.location.assign(destination);
      return;
    }

    // A verified sign-in carrying no role at all: an account that exists in
    // Firebase but was never granted claims. The console would turn them
    // straight back around, so this stops here and says what is missing.
    setSubmitting(false);
    setErrors({
      password: "This account has no role yet. Ask operations to grant one.",
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: { email?: string; password?: string } = {};
    if (email.trim() === "") found.email = "Email — required";
    else if (!EMAIL.test(email.trim()))
      found.email = "That does not look like an email address";
    if (password === "") found.password = "Password — required";

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    const result = await signIn(email.trim(), password);

    if (!result.ok) {
      setSubmitting(false);
      // Beside the field rather than as a toast alone: the error belongs next
      // to the thing that has to change.
      setErrors({ password: result.error });
      toast.error(result.error ?? "Could not sign in.");
      return;
    }

    if (result.needsProfile) {
      setSubmitting(false);
      setErrors({
        password: "This account has no role yet. Ask operations to grant one.",
      });
      return;
    }

    land(result.role);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email" className="text-sm">
          Work email
        </Label>
        <Input
          id="admin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@pasumai.trade"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((x) => ({ ...x, email: undefined }));
          }}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "admin-email-error" : undefined}
        />
        {errors.email ? (
          <p
            id="admin-email-error"
            className="text-destructive flex items-center gap-1 text-xs"
          >
            <TriangleAlertIcon className="size-3 shrink-0" />
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="admin-password" className="text-sm">
            Password
          </Label>
          {/*
            No self-service reset. Operations accounts are issued by operations,
            and a reset link on the console door is a way in that does not
            depend on knowing the password — so this says who to ask instead of
            offering a form that would have to be defended.
          */}
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Ask another operations account to reset it for you — there is no self-service reset on this door.",
              )
            }
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
          >
            Forgotten it?
          </button>
        </div>
        <PasswordInput
          id="admin-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((x) => ({ ...x, password: undefined }));
          }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "admin-password-error" : undefined}
        />
        {errors.password ? (
          <p
            id="admin-password-error"
            className="text-destructive flex items-center gap-1 text-xs"
          >
            <TriangleAlertIcon className="size-3 shrink-0" />
            {errors.password}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting} className="mt-1" size="lg">
        {submitting ? "Signing in…" : "Sign in to the console"}
        {!submitting ? <ArrowRightIcon className="size-4" /> : null}
      </Button>
    </form>
  );
}
