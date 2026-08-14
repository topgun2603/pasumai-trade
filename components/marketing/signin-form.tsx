"use client";

import {
  ArrowRightIcon,
  InfoIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkMobile } from "@/lib/domain/registration";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export type Audience = "buyer" | "admin" | "farmer";

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
  const router = useRouter();
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
      value: "farmer",
      label: t.signin.farmer,
      blurb: t.signin.farmerBlurb,
      destination: `/${locale}`,
      icon: SmartphoneIcon,
    },
  ];

  const active = audiences.find((a) => a.value === audience)!;
  const isFarmer = audience === "farmer";

  function submit(event: React.FormEvent) {
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

    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);

      if (isFarmer) {
        toast.info("The farmer app is not available yet");
        return;
      }

      // Authentication is not connected yet — see the notice below the form.
      // This routes to the console so the surfaces can be reviewed; it does
      // not verify anybody.
      toast.warning(t.signin.notConnectedTitle);
      router.push(active.destination);
    }, 450);
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
        Stated plainly rather than buried. Anyone reviewing these surfaces
        should know the door is open, and it must be closed before this is
        put anywhere public.
      */}
      <div className="border-warning/40 bg-warning-soft rounded-lg border px-3.5 py-3">
        <p className="flex items-start gap-2 text-sm">
          <InfoIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">{t.signin.notConnectedTitle}</span>{" "}
            {t.signin.notConnectedBody}
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
