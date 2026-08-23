"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MailIcon,
  HardHatIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  StoreIcon,
  TruckIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { MobileOtpForm } from "@/components/marketing/mobile-otp-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { sendVerificationEmail, signIn } from "@/lib/auth/sign-in";
import {
  checkPasswordConfirmation,
  validateCredentials,
  type SignupForm,
  type SignupRole,
} from "@/lib/domain/signup";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

const DOORS: Record<
  SignupRole,
  {
    label: string;
    blurb: string;
    nameLabel: string;
    placeLabel: string;
    icon: typeof UserRoundIcon;
  }
> = {
  farmer: {
    label: "Farmer",
    blurb: "List what you grow, and bargain on your own price.",
    nameLabel: "Your name",
    placeLabel: "Village",
    icon: SmartphoneIcon,
  },
  franchise: {
    label: "Franchise",
    blurb: "Buy graded produce for a franchise outlet.",
    nameLabel: "Business name",
    placeLabel: "Town",
    icon: StoreIcon,
  },
  buyer: {
    label: "Buyer",
    blurb: "Buy direct from farmers — hotels, caterers, retailers.",
    nameLabel: "Business name",
    placeLabel: "Town",
    icon: UserRoundIcon,
  },
  transport: {
    label: "Transportation",
    blurb: "Register a fleet, then add your vehicles and drivers.",
    nameLabel: "Agency name",
    placeLabel: "Town",
    icon: TruckIcon,
  },
  manpower: {
    label: "Manpower",
    blurb: "Register an agency, then add the crew you supply.",
    nameLabel: "Agency name",
    placeLabel: "Town",
    icon: HardHatIcon,
  },
};

const ORDER: SignupRole[] = [
  "farmer",
  "franchise",
  "buyer",
  "transport",
  "manpower",
];

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-destructive flex items-center gap-1 text-xs"
        >
          <TriangleAlertIcon className="size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function SignUpForm({
  initial,
  locale,
}: {
  initial: SignupRole;
  locale: Locale;
  t: Dictionary;
}) {
  const [values, setValues] = useState<SignupForm>({
    role: initial,
    name: "",
    contactName: "",
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
    place: "",
    state: "",
    district: "",
    pincode: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof SignupForm, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  /*
    Mobile is the default door for a farmer and the second one for everybody
    else — a business registering has an email and expects to use it, a grower
    has a handset.
  */
  const [method, setMethod] = useState<"otp" | "password">(
    initial === "farmer" ? "otp" : "password",
  );

  const door = DOORS[initial];
  const isFarmer = initial === "farmer";

  function set<K extends keyof SignupForm>(key: K, value: SignupForm[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // The confirmation is not in the payload and never should be: the server
    // has nothing to check it against, and it would be a second copy of a
    // password travelling for no reason.
    const payload = { email: values.email, password: values.password };

    const found = {
      ...validateCredentials(payload),
      confirmPassword: checkPasswordConfirmation(
        values.password,
        values.confirmPassword ?? "",
      ),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSubmitting(false);
      toast.error(
        "Could not reach the server. Check your connection and try again.",
      );
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      accountId?: string;
      error?: string;
      fields?: Record<string, string>;
    };

    if (!response.ok) {
      setSubmitting(false);
      // Server-side field errors land on the fields they belong to, so a
      // duplicate email is shown at the email box rather than as a toast the
      // person has to map back themselves.
      if (data.fields)
        setErrors(data.fields as Partial<Record<keyof SignupForm, string>>);
      toast.error(data.error ?? "Could not create the account.");
      return;
    }

    /*
      Prove the address, now that there is an account behind it.

      The account was created by the Admin SDK on the server, which can generate
      a verification link but cannot deliver one. Signing in here hands the
      browser a Firebase user, and the browser can ask Firebase to send the
      email itself — no provider to configure and nothing billed per message.

      Failures are shown but do not undo anything. The account exists and works;
      an unproven address is a thing to chase, not a reason to throw away a
      registration somebody just completed.
    */
    let sent = false;
    let signedInOk = false;
    try {
      const signedIn = await signIn(payload.email, payload.password);
      signedInOk = signedIn.ok;
      if (signedIn.ok) {
        const posted = await sendVerificationEmail();
        sent = posted.ok;
      }
    } catch {
      // Same reasoning: the account is real either way.
    }

    setSubmitting(false);
    setVerificationSent(sent);
    setCreated(true);

    /*
      Straight to the profile step, where the account is actually created.

      Only if the sign-in above worked: the profile endpoint needs the session
      that produced, and sending them to a page that would bounce them back is
      worse than showing the confirmation and letting them sign in.
    */
    // Same reason as the sign-in form: a different root layout, so this is a
    // document load either way.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (sent || signedInOk) window.location.assign(`/profile?as=${initial}`);
  }

  if (created) {
    return (
      <div className="flex flex-col gap-6">
        <div className="border-success/30 bg-success-soft flex items-start gap-3 rounded-lg border px-4 py-4">
          <CheckCircle2Icon className="text-success mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">Account created</span>
            <p className="text-muted-foreground text-sm">
              Your reference is <span className="font-mono">{created}</span>.
              Worth keeping — it is what operations ask for if you ever phone
              them.
            </p>
          </div>
        </div>

        {/*
          Said here rather than in a toast that vanishes. Somebody who does not
          see this line will not know to look in their inbox, and an address
          nobody proves is one operations has to chase by telephone.
        */}
        <div className="bg-secondary flex items-start gap-3 rounded-lg px-4 py-3.5">
          <MailIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-sm">
            {verificationSent ? (
              <>
                We have sent a link to{" "}
                <span className="text-foreground font-medium">
                  {values.email}
                </span>
                . Open it to confirm the address is yours — you can sign in and
                look around before you do.
              </>
            ) : (
              <>
                We could not send the confirmation email just now. Nothing is
                wrong with the account — sign in and ask for it again from your
                account page.
              </>
            )}
          </p>
        </div>

        {/*
          What actually happens next, which is: they are in.

          This used to promise a two-day wait for approval, from when accounts
          were issued by hand and nothing worked until operations had checked
          the documents. None of that is true now — registration creates a
          working login, the gate on trading is the subscription, and
          verification is a separate thing that is instant wherever eKYC is
          switched on. Telling somebody to wait two days at the exact moment
          they could be looking at prices is the worst possible time to be
          wrong.

          No farmer branch either. The farmer console exists, so a farmer signs
          in like everybody else.
        */}
        <div className="bg-secondary flex flex-col gap-2 rounded-lg px-4 py-3.5">
          <span className="text-sm font-medium">What happens now</span>
          <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-4 text-sm">
            <li>Sign in now — your account is ready.</li>
            <li>Looking around is free: prices, listings and who is buying.</li>
            <li>
              {isFarmer
                ? "Take a plan when you want to post produce and bargain."
                : "Take a plan when you want to bargain and order."}
            </li>
            <li>Verification is in your console, and most of it is instant.</li>
          </ol>
        </div>

        <Button asChild>
          <Link href={`/${locale}/signin?as=${initial}`}>
            Sign in
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-primary/25 bg-accent flex items-start gap-3 rounded-lg border px-3.5 py-3">
        <span className="bg-primary text-primary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
          <door.icon className="size-4" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{door.label}</span>
          <span className="text-muted-foreground text-sm">{door.blurb}</span>
        </span>
      </div>

      {/*
        Mobile first, for the same reason sign-in leads with it: a farmer has a
        handset and often no email habit, and an OTP proves the number rather
        than merely collecting it.

        The same operation as signing in — Firebase creates the user when the
        number is unknown — so a new number lands at the profile step and a
        known one goes to its console. Which of the two is decided by the
        result, not by which page they started on.
      */}
      {method === "otp" ? (
        <MobileOtpForm
          containerId="signup-recaptcha"
          labels={{
            mobile: "Mobile number",
            code: "Six-digit code",
            send: "Send one-time code",
            sending: "Sending…",
            submit: "Verify and continue",
            submitting: "Checking…",
          }}
          onDone={(result) => {
            if (result.needsProfile || !result.role) {
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign(`/profile?as=${initial}`);
              return;
            }
            // A number that already has an account: this was a sign-in.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(
              result.role in HOME_FOR_ROLE
                ? HOME_FOR_ROLE[result.role as keyof typeof HOME_FOR_ROLE]
                : "/",
            );
          }}
        />
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {/*
          Only what it takes to open a login.

          Name, mobile and address used to be here — seven fields before the
          person had an account or any reason to trust the form. They are asked
          at the profile step now, which every console is gated on, so a
          registration abandoned halfway leaves a login they can come back to
          rather than nothing at all.
        */}
          <Field id="email" label="Email" error={errors.email}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.in"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={errors.password}
            hint="At least 8 characters, with a capital letter, a number and a symbol."
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
          </Field>

          {/*
            Typed twice, because this one cannot be recovered by reading it
            back — the field is masked, and the first thing a wrong password
            does is lock somebody out of the account they just made.
          */}
          <Field
            id="confirmPassword"
            label="Confirm password"
            error={errors.confirmPassword}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={values.confirmPassword ?? ""}
              onChange={(e) => set("confirmPassword", e.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
          </Field>

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting ? "Creating account…" : "Create account"}
            {!submitting ? <ArrowRightIcon className="size-4" /> : null}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-faint text-xs">or</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <button
          type="button"
          onClick={() => setMethod((m) => (m === "otp" ? "password" : "otp"))}
          className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {method === "otp" ? (
            <>
              <MailIcon className="size-4" />
              Use email and password instead
            </>
          ) : (
            <>
              <SmartphoneIcon className="size-4" />
              Register with your mobile instead
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">
          Registering as something else?
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.filter((r) => r !== initial).map((r) => (
            <Link
              key={r}
              href={`/${locale}/signup?as=${r}`}
              className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {(() => {
                const Icon = DOORS[r].icon;
                return <Icon className="size-3" />;
              })()}
              {DOORS[r].label}
            </Link>
          ))}
        </div>
      </div>

      {/* Operations is not on this page and cannot be. The account that can
          verify everyone else is not one anyone grants themselves. */}
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Operations accounts are not created here — they are issued internally.
        </span>
      </p>

      <p className="text-muted-foreground text-center text-sm">
        Already registered?{" "}
        <Link
          href={`/${locale}/signin?as=${initial}`}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
