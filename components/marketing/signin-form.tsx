"use client";

import {
  ArrowRightIcon,
  InfoIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { signIn } from "@/lib/auth/sign-in";
import { checkMobile } from "@/lib/domain/registration";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export type Audience = "buyer" | "admin" | "agency" | "farmer";

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
      value: "buyer",
      label: t.signin.buyer,
      blurb: t.signin.buyerBlurb,
      destination: "/market",
      icon: UserRoundIcon,
    },
    {
      value: "admin",
      label: t.signin.operations,
      blurb: t.signin.adminBlurb,
      destination: "/admin",
      icon: ShieldCheckIcon,
    },
    {
      // Transport and manpower contractors are one account type, differing
      // only in what they are contracted for — so one door, not two.
      value: "agency",
      label: t.signin.agency,
      blurb: t.signin.agencyBlurb,
      destination: "/agency",
      icon: TruckIcon,
    },
    {
      value: "farmer",
      label: t.signin.farmer,
      blurb: t.signin.farmerBlurb,
      destination: `/${locale}`,
      icon: SmartphoneIcon,
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
      <Tabs
        value={audience}
        onValueChange={(v) => {
          setAudience(v as Audience);
          setErrors({});
        }}
      >
        <TabsList className="w-full">
          {audiences.map((option) => (
            <TabsTrigger key={option.value} value={option.value} className="flex-1">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="bg-secondary text-muted-foreground flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm">
        <active.icon className="text-foreground mt-0.5 size-4 shrink-0" />
        <span>{active.blurb}</span>
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
