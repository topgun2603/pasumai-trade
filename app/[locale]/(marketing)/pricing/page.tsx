import { ArrowRightIcon, EyeIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanCard } from "@/components/billing/plan-card";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/lib/auth/claims";
import {
  CAPABILITY_LABELS,
  CAPABILITIES_FOR_ROLE,
  DEFAULT_PLANS,
  FREE_CAPABILITIES,
  isFree,
} from "@/lib/domain/subscription";
import { isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Pricing · Pasumai Trade",
    description:
      "Looking is free — every listing, every settled price. A plan is what lets you post, bargain and order.",
  };
}

/** Ordered so the two sides of the trade lead, and the services follow. */
const ORDER: Role[] = ["farmer", "buyer", "franchise", "transport", "manpower"];

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 py-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <h1 className="font-heading-display text-4xl tracking-tight sm:text-5xl">
          Looking is free. Trading is what you pay for.
        </h1>
        <p className="text-muted-foreground text-lg">
          Register and see everything — what is growing, what it graded at, what it settled for,
          which agencies cover your district. Take a plan when you want to act on it.
        </p>
      </header>

      {/*
        The free tier stated before any price. Someone deciding whether to
        register needs to know what they get for nothing, and burying it under
        five plan cards would read as though registration itself costs money.
      */}
      <section className="border-primary/25 bg-accent flex flex-col gap-3 rounded-xl border p-6">
        <span className="flex items-center gap-2 font-medium">
          <EyeIcon className="size-4" /> Free, with any account
        </span>
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {FREE_CAPABILITIES.map((capability) => (
            <li key={capability} className="text-sm">
              {CAPABILITY_LABELS[capability]}
            </li>
          ))}
          <li className="text-sm">See every settled price, grade by grade</li>
          <li className="text-sm">Search farmers, buyers and agencies</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          No card, no trial clock. Registration takes a minute and costs nothing.
        </p>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
          <p className="text-muted-foreground text-sm">
            Priced per kind of account, because a grower with two acres and a franchise sourcing
            across six districts are not the same customer. Yearly saves roughly two months.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ORDER.flatMap((role) =>
            DEFAULT_PLANS.filter((plan) => plan.role === role).map((plan) => (
              <div key={plan.id} className="flex flex-col gap-2">
                <span className="text-faint text-xs tracking-wide uppercase">
                  {ROLE_LABELS[role]}
                </span>
                <PlanCard
                  plan={plan}
                  period="monthly"
                  footer={
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/${locale}/signup?as=${role}`}>
                        Start free
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    </Button>
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Unlocks:{" "}
                  {CAPABILITIES_FOR_ROLE[role]
                    .filter((c) => !isFree(c))
                    .map((c) => CAPABILITY_LABELS[c].toLowerCase())
                    .join(", ")}
                  .
                </p>
              </div>
            )),
          )}
        </div>
      </section>

      {/*
        How payment actually works today, said plainly. There is no gateway
        yet, and a pricing page implying instant card checkout would be a
        promise the platform cannot keep at the moment somebody tries to pay.
      */}
      <section className="bg-secondary flex flex-col gap-2 rounded-xl px-6 py-5">
        <h2 className="font-medium">How you pay</h2>
        <p className="text-muted-foreground text-sm">
          Choose a plan in your console and you are given a payment reference. Transfer the amount
          quoting that reference and operations switch the plan on, usually the same working day.
          Card and UPI checkout are not live yet.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={`/${locale}/signup?as=farmer`}>
            Register free
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/${locale}/signin`}>Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
