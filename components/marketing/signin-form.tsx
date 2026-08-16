"use client";

import {
  ArrowRightIcon,
  InfoIcon,
  KeyRoundIcon,
  MailIcon,
  ShieldCheckIcon,
  HardHatIcon,
  SmartphoneIcon,
  StoreIcon,
  TruckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import {
  confirmPhoneCode,
  resetPhoneVerifier,
  signIn,
  startPhoneSignIn,
} from "@/lib/auth/sign-in";
import { checkMobile, toE164 } from "@/lib/domain/registration";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/lib/auth/claims";

/** One per door on the public rail. Same set as the platform's roles. */
export type Audience = Role;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SignInForm({
  initial = "buyer",
  locale,
  t,
}: {
  initial?: Audience;
  locale: Locale;
  t: Dictionary;
}) {
  const [audience, setAudience] = useState<Audience>(initial);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  /*
   * Two ways in, one session.
   *
   * OTP is offered first to farmers, who have a phone and often no email
   * habit, and offered second to everyone else. Both paths end at the same
   * exchange: a Firebase ID token posted once to /api/auth/session. Signup
   * puts the mobile on the same user record as the email, so the token an SMS
   * sign-in produces already carries the role and accountId claims.
   */
  const [method, setMethod] = useState<"password" | "otp">(
    initial === "farmer" ? "otp" : "password",
  );
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [confirmer, setConfirmer] = useState<Awaited<
    ReturnType<typeof startPhoneSignIn>
  >["confirmer"]>(undefined);

  const audiences: Array<{
    value: Audience;
    label: string;
    blurb: string;
    destination: string;
    icon: typeof UserRoundIcon;
  }> = [
    {
      value: "admin",
      label: t.doors.admin,
      blurb: t.signin.adminBlurb,
      destination: "/admin",
      icon: ShieldCheckIcon,
    },
    {
      value: "farmer",
      label: t.doors.farmer,
      blurb: t.signin.farmerBlurb,
      destination: "/farm",
      icon: SmartphoneIcon,
    },
    {
      value: "franchise",
      label: t.doors.franchise,
      blurb: t.signin.franchiseBlurb,
      destination: "/listings",
      icon: StoreIcon,
    },
    {
      value: "buyer",
      label: t.doors.buyer,
      blurb: t.signin.buyerBlurb,
      destination: "/listings",
      icon: UserRoundIcon,
    },
    {
      value: "transport",
      label: t.doors.transport,
      blurb: t.signin.transportBlurb,
      destination: "/agency",
      icon: TruckIcon,
    },
    {
      value: "manpower",
      label: t.doors.manpower,
      blurb: t.signin.manpowerBlurb,
      destination: "/agency",
      icon: HardHatIcon,
    },
  ];

  const active = audiences.find((a) => a.value === audience)!;

  /*
   * Every door takes an email and a password, farmers included.
   *
   * This form used to show farmers a mobile-and-OTP flow that was wired to
   * nothing: it validated the number, then said the farmer app did not exist.
   * Phone sign-in needs Firebase Phone auth, a reCAPTCHA and a billing
   * account, none of which are set up — and signup already issues farmers an
   * email and a password. Mobile OTP is worth having; refusing the credential
   * they already hold was not the way to wait for it.
   */

  /** Land where the account is entitled to go, not where the tab said. */
  function land(role: string | undefined) {
    const destination =
      role && role in HOME_FOR_ROLE
        ? HOME_FOR_ROLE[role as keyof typeof HOME_FOR_ROLE]
        : active.destination;
    // A full navigation: the console reads the session on the server, and a
    // client-side push would render against the old cache.
    window.location.assign(destination);
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();

    const problem = checkMobile(mobile);
    if (problem) {
      setErrors({ identifier: problem });
      return;
    }

    // Validated above, so this cannot be null — but the null branch stays
    // rather than a non-null assertion, because the two checks could drift.
    const e164 = toE164(mobile);
    if (!e164) {
      setErrors({ identifier: "That is not a valid mobile number." });
      return;
    }

    setSubmitting(true);
    const result = await startPhoneSignIn(e164, "recaptcha-holder");
    setSubmitting(false);

    if (!result.ok || !result.confirmer) {
      setErrors({ identifier: result.error });
      toast.error(result.error ?? "Could not send a code.");
      return;
    }

    setConfirmer(result.confirmer);
    setErrors({});
    toast.success(`Code sent to ${mobile}`);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();

    if (code.trim().length < 6) {
      setErrors({ password: "Enter the six-digit code." });
      return;
    }
    if (!confirmer) return;

    setSubmitting(true);
    const result = await confirmPhoneCode(confirmer, code.trim());

    if (!result.ok) {
      setSubmitting(false);
      setErrors({ password: result.error });
      toast.error(result.error ?? "Could not sign in.");
      return;
    }

    land(result.role);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: { identifier?: string; password?: string } = {};

    if (identifier.trim() === "") {
      found.identifier = `${t.signin.email} — ${t.common.required}`;
    } else if (!EMAIL.test(identifier.trim())) {
      found.identifier = "That does not look like an email address";
    }

    if (password === "") {
      found.password = `${t.signin.password} — ${t.common.required}`;
    }

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    const result = await signIn(identifier.trim(), password);

    if (!result.ok) {
      setSubmitting(false);
      // On the password field rather than as a toast alone: the error belongs
      // beside the thing that has to change.
      setErrors({ password: result.error });
      toast.error(result.error ?? "Could not sign in.");
      return;
    }

    // A buyer who signed in under the operations tab still lands on the market
    // rather than on a page that would refuse them.
    land(result.role);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Six tabs do not fit, and the rail on the public site already named
          the door. So this shows the one that was chosen, with the others a
          click away rather than competing for the same row. */}
      <div className="border-primary/25 bg-accent flex items-start gap-3 rounded-lg border px-3.5 py-3">
        <span className="bg-primary text-primary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
          <active.icon className="size-4" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{active.label}</span>
          <span className="text-muted-foreground text-sm">{active.blurb}</span>
        </span>
      </div>

      {method === "otp" ? (
        <form
          onSubmit={confirmer ? verifyCode : sendCode}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mobile" className="text-sm">
              {t.signin.mobile}
            </Label>
            <Input
              id="mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98430 11204"
              value={mobile}
              // Locked once a code is on its way. Changing the number while
              // holding a code for the old one is how somebody ends up typing
              // a valid code against the wrong number.
              disabled={Boolean(confirmer)}
              onChange={(e) => {
                setMobile(e.target.value);
                setErrors((x) => ({ ...x, identifier: undefined }));
              }}
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "mobile-error" : undefined}
            />
            {errors.identifier ? (
              <p id="mobile-error" className="text-destructive flex items-center gap-1 text-xs">
                <TriangleAlertIcon className="size-3 shrink-0" />
                {errors.identifier}
              </p>
            ) : null}
          </div>

          {confirmer ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code" className="text-sm">
                Six-digit code
              </Label>
              <Input
                id="code"
                inputMode="numeric"
                // Lets Android and iOS offer the code straight from the SMS
                // rather than making someone switch apps to read it.
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="text-center font-mono text-lg tracking-[0.4em]"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/[^0-9]/g, ""));
                  setErrors((x) => ({ ...x, password: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "code-error" : undefined}
              />
              {errors.password ? (
                <p id="code-error" className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlertIcon className="size-3 shrink-0" />
                  {errors.password}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  resetPhoneVerifier();
                  setConfirmer(undefined);
                  setCode("");
                  setErrors({});
                }}
                className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
              >
                Wrong number, or no code arrived?
              </button>
            </div>
          ) : null}

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting
              ? confirmer
                ? t.signin.signingIn
                : t.signin.sendingCode
              : confirmer
                ? t.signin.submit
                : t.signin.sendCode}
            {!submitting ? <ArrowRightIcon className="size-4" /> : null}
          </Button>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier" className="text-sm">
              {t.signin.email}
            </Label>
            <Input
              id="identifier"
              key={audience}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setErrors((x) => ({ ...x, identifier: undefined }));
              }}
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
              placeholder="you@company.in"
            />
            {errors.identifier ? (
              <p
                id="identifier-error"
                className="text-destructive flex items-center gap-1 text-xs"
              >
                <TriangleAlertIcon className="size-3 shrink-0" />
                {errors.identifier}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="password" className="text-sm">
                {t.signin.password}
              </Label>
              <button
                type="button"
                onClick={() => toast.info(t.signin.forgotten)}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              >
                {t.signin.forgotten}
              </button>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: undefined }));
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            {errors.password ? (
              <p id="password-error" className="text-destructive flex items-center gap-1 text-xs">
                <TriangleAlertIcon className="size-3 shrink-0" />
                {errors.password}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting ? t.signin.signingIn : t.signin.submit}
            {!submitting ? <ArrowRightIcon className="size-4" /> : null}
          </Button>
        </form>
      )}

      {/* Where the invisible reCAPTCHA mounts. Firebase will not send an SMS
          without it and it needs a real element in the document, so it lives
          here rather than being conjured on demand. */}
      <div id="recaptcha-holder" />

      <button
        type="button"
        onClick={() => {
          resetPhoneVerifier();
          setConfirmer(undefined);
          setCode("");
          setErrors({});
          setMethod((m) => (m === "otp" ? "password" : "otp"));
        }}
        className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {method === "otp" ? (
          <>
            <MailIcon className="size-4" />
            Use email and password instead
          </>
        ) : (
          <>
            <KeyRoundIcon className="size-4" />
            Send me a code by SMS instead
          </>
        )}
      </button>

      {/*
        Anyone can register except operations, whose accounts are still issued
        internally — so this offers the door when there is one and says why
        there is not when there is not, rather than showing a link that leads
        to a redirect.
      */}
      <div className="bg-secondary rounded-lg px-3.5 py-3">
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          {audience === "admin" ? (
            <span>Operations accounts are issued internally, not by signing up.</span>
          ) : (
            <span>
              No account yet?{" "}
              <Link
                href={`/${locale}/signup?as=${audience}`}
                className="text-primary hover:underline"
              >
                Register as {active.label.toLowerCase()}
              </Link>{" "}
              — it takes a minute and you can sign in straight away.
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">{t.signin.otherDoors}</span>
        <div className="flex flex-wrap gap-1.5">
          {audiences
            .filter((option) => option.value !== audience)
            .map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setAudience(option.value);
                  setErrors({});
                }}
                className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <option.icon className="size-3" />
                {option.label}
              </button>
            ))}
        </div>
      </div>

    </div>
  );
}
