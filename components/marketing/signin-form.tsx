"use client";

import {
  ArrowRightIcon,
  InfoIcon,
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
import { signIn } from "@/lib/auth/sign-in";
import { checkMobile } from "@/lib/domain/registration";
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
      destination: `/${locale}`,
      icon: SmartphoneIcon,
    },
    {
      value: "franchise",
      label: t.doors.franchise,
      blurb: t.signin.franchiseBlurb,
      destination: "/market",
      icon: StoreIcon,
    },
    {
      value: "buyer",
      label: t.doors.buyer,
      blurb: t.signin.buyerBlurb,
      destination: "/market",
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
  const isFarmer = audience === "farmer";

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const found: { identifier?: string; password?: string } = {};

    if (isFarmer) {
      found.identifier = checkMobile(identifier);
    } else if (identifier.trim() === "") {
      found.identifier = `${t.signin.email} — ${t.common.required}`;
    } else if (!EMAIL.test(identifier.trim())) {
      found.identifier = "That does not look like an email address";
    }

    if (!isFarmer && password === "") {
      found.password = `${t.signin.password} — ${t.common.required}`;
    }

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    if (isFarmer) {
      toast.info("The farmer app is not available yet");
      return;
    }

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

    // Where the account is entitled to go, not the tab that was clicked. A
    // buyer who signed in under the operations tab still lands on the market
    // rather than on a page that would refuse them.
    const destination =
      result.role && result.role in HOME_FOR_ROLE
        ? HOME_FOR_ROLE[result.role as keyof typeof HOME_FOR_ROLE]
        : active.destination;

    // The console reads the session on the server, so a full navigation is
    // needed — a client-side push would render against the old cache.
    window.location.assign(destination);
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

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="identifier" className="text-sm">
            {isFarmer ? t.signin.mobile : t.signin.email}
          </Label>
          <Input
            id="identifier"
            key={audience}
            type={isFarmer ? "tel" : "email"}
            inputMode={isFarmer ? "tel" : "email"}
            autoComplete={isFarmer ? "tel" : "email"}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setErrors((x) => ({ ...x, identifier: undefined }));
            }}
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? "identifier-error" : undefined}
            placeholder={isFarmer ? "98430 11204" : "you@company.in"}
          />
          {errors.identifier ? (
            <p id="identifier-error" className="text-destructive flex items-center gap-1 text-xs">
              <TriangleAlertIcon className="size-3 shrink-0" />
              {errors.identifier}
            </p>
          ) : null}
        </div>

        {!isFarmer ? (
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
        ) : null}

        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting
            ? isFarmer
              ? t.signin.sendingCode
              : t.signin.signingIn
            : isFarmer
              ? t.signin.sendCode
              : t.signin.submit}
          {!submitting ? <ArrowRightIcon className="size-4" /> : null}
        </Button>
      </form>

      {/*
        Accounts are created by operations, not by signing up. A buyer is
        verified against a GST number before they may order and a farmer is
        onboarded by a franchise, so there is no self-registration to offer —
        and saying so beats leaving someone hunting for a button that does not
        exist.
      */}
      <div className="bg-secondary rounded-lg px-3.5 py-3">
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Accounts are issued by operations. If you do not have one, ask them
            to create it — there is no self sign-up.
          </span>
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

      <p className="text-muted-foreground text-center text-sm">
        {t.signin.noAccount}{" "}
        <Link href={`/${locale}#apply`} className="text-primary hover:underline">
          {t.signin.requestOne}
        </Link>{" "}
        — {t.signin.accountsNote}
      </p>
    </div>
  );
}
