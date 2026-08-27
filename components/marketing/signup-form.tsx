"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MailIcon,
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
import { fill, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/*
  The mark each door gets, and nothing else.

  The label and the blurb used to sit beside the icon as English literals, which
  is how a Tamil page came to name its doors "Farmer" and "Transportation" — the
  dictionary had those five blurbs translated the whole time and no one read
  them. They come from `t` now. An icon is the only part of a door that does not
  change with the language.

  `nameLabel` and `placeLabel` are dropped rather than moved: the name and place
  fields left this form for the profile step, and the labels have had nothing to
  label since.
*/
const DOOR_ICONS: Record<SignupRole, typeof UserRoundIcon> = {
  farmer: SmartphoneIcon,
  franchise: StoreIcon,
  buyer: UserRoundIcon,
  transport: TruckIcon,
  manpower: HardHatIcon,
};

/** Which blurb each door reads — the dictionary names them per role. */
const DOOR_BLURB = {
  farmer: "blurbFarmer",
  franchise: "blurbFranchise",
  buyer: "blurbBuyer",
  transport: "blurbTransport",
  manpower: "blurbManpower",
} as const satisfies Record<SignupRole, keyof Dictionary["signup"]>;

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
  t,
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
  /*
    The account id the server hands back, which the confirmation screen names.

    It was being read off the response and thrown away, and the line that quotes
    it was interpolating `created` — a boolean, which React renders as nothing
    at all. Kept separate from `created` rather than folded into it so the
    screen still appears when the server answers without an id: a confirmation
    that does not show is worse than one missing its reference number.
  */
  const [reference, setReference] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  /*
    Mobile is the default door for everybody, as it is on sign-in.

    It used to be first for a farmer and second for the rest, on the reasoning
    that a business registering has an email and expects to use it. Registering
    and signing in then disagreed about which came first for the same person,
    and the door they walked through decided which form they met. A number is
    what every one of them has; the email and password are one control away.

    An OTP also *proves* the number rather than collecting it, which matters
    more at registration than at sign-in — this is where the number that later
    carries the account gets set.
  */
  const [method, setMethod] = useState<"otp" | "password">("otp");

  const DoorIcon = DOOR_ICONS[initial];
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
      toast.error(t.signup.unreachable);
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
      toast.error(data.error ?? t.signup.couldNotCreate);
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
    setReference(data.accountId ?? null);
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
            <span className="font-medium">{t.signup.createdTitle}</span>
            {/* One string with the reference inside it rather than a sentence
                assembled from fragments: where the number falls in the line is
                not the same in all six languages, and splitting it would fix
                English word order onto the other five. */}
            {reference ? (
              <p className="text-muted-foreground text-sm">
                {fill(t.signup.reference, { ref: reference })}
              </p>
            ) : null}
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
            {verificationSent
              ? fill(t.signup.verifySent, { email: values.email })
              : t.signup.verifyFailed}
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
          <span className="text-sm font-medium">{t.signup.whatNow}</span>
          <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-4 text-sm">
            <li>{t.signup.now1}</li>
            <li>{t.signup.now2}</li>
            <li>{isFarmer ? t.signup.now3Farmer : t.signup.now3Other}</li>
            <li>{t.signup.now4}</li>
          </ol>
        </div>

        <Button asChild>
          <Link href={`/${locale}/signin?as=${initial}`}>
            {t.signup.signIn}
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
          <DoorIcon className="size-4" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{t.doors[initial]}</span>
          <span className="text-muted-foreground text-sm">
            {t.signup[DOOR_BLURB[initial]]}
          </span>
        </span>
      </div>

      {/*
        The other doors, above the form rather than below it.

        Which door you are at decides what the account becomes, so it belongs
        with the badge that names it and ahead of the first field — not after
        the number has been typed and an OTP sent, which is where it used to
        sit and where changing it threw that work away.
      */}
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">
          {t.signup.registeringElse}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.filter((r) => r !== initial).map((r) => (
            <Link
              key={r}
              href={`/${locale}/signup?as=${r}`}
              className="border-border hover:bg-secondary focus-visible:ring-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {(() => {
                const Icon = DOOR_ICONS[r];
                return <Icon className="size-3" />;
              })()}
              {t.doors[r]}
            </Link>
          ))}
        </div>
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
            mobile: t.signup.mobile,
            code: t.signup.code,
            send: t.signup.send,
            sending: t.signup.sending,
            submit: t.signup.verify,
            submitting: t.signup.checking,
            differentNumber: t.signup.differentNumber,
            mobileRequired: t.signup.mobileRequired,
            badMobile: t.signup.badMobile,
            enterCode: t.signup.enterCode,
            codeSent: t.signup.codeSent,
            couldNotSend: t.signup.couldNotSend,
            couldNotSignIn: t.signup.couldNotSignIn,
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
          <Field id="email" label={t.signup.email} error={errors.email}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t.signup.emailPlaceholder}
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            id="password"
            label={t.signup.password}
            error={errors.password}
            hint={t.signup.passwordHint}
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
            label={t.signup.confirmPassword}
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
            {submitting ? t.signup.creating : t.signup.create}
            {!submitting ? <ArrowRightIcon className="size-4" /> : null}
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-faint text-xs">{t.signup.or}</span>
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
              {t.signup.useEmail}
            </>
          ) : (
            <>
              <SmartphoneIcon className="size-4" />
              {t.signup.useMobile}
            </>
          )}
        </button>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        {t.signup.alreadyRegistered}{" "}
        <Link
          href={`/${locale}/signin?as=${initial}`}
          className="text-primary hover:underline"
        >
          {t.signup.signIn}
        </Link>
      </p>
    </div>
  );
}
