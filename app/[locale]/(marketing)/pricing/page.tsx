import { ArrowRightIcon, EyeIcon, InfinityIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlanCard } from "@/components/billing/plan-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/domain/money";
import {
  BADGES,
  CAPABILITY_LABELS,
  FRANCHISE_FIRST_YEAR,
  FRANCHISE_RENEWAL,
  FREE_CAPABILITIES,
  STANDARD_TERMS,
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
      "Looking is free — every listing, every settled price. From ₹199 a month to trade, or ₹4,999 once and never again.",
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ladder = STANDARD_TERMS.filter((t) => !t.highlight);
  const lifetime = STANDARD_TERMS.find((t) => t.highlight)!;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 py-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <h1 className="font-heading-display text-4xl tracking-tight sm:text-5xl">
          Looking is free. Trading is what you pay for.
        </h1>
        <p className="text-muted-foreground text-lg">
          One price list for farmers, buyers, transport and crew. The longer the term, the less it
          costs a month — and every term buys exactly the same thing.
        </p>
      </header>

      {/*
        The free tier stated before any price. Somebody deciding whether to
        register needs to know what they get for nothing, and burying it under
        seven cards would read as though registration itself costs money.
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
          <h2 className="text-2xl font-semibold tracking-tight">Choose a term</h2>
          <p className="text-muted-foreground text-sm">
            Posting, bargaining, ordering and dispatch — all of it, on every term. A longer term is
            cheaper per month and carries a higher badge, and buys nothing else.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ladder.map((option) => (
            <PlanCard
              key={option.term}
              option={option}
              footer={
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/${locale}/signup?as=farmer`}>Start free</Link>
                </Button>
              }
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or stop paying altogether</span>
            <span className="bg-border h-px flex-1" />
          </div>
          <div className="sm:max-w-sm">
            <PlanCard
              option={lifetime}
              footer={
                <Button asChild className="w-full">
                  <Link href={`/${locale}/signup?as=farmer`}>
                    Start free
                    <ArrowRightIcon className="size-4" />
                  </Link>
                </Button>
              }
            />
          </div>
        </div>
      </section>

      {/* Badges, shown together so the ladder reads as a ladder. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What you wear</h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Your badge shows on your listings and in every bargain, so the other side of the trade
          can see how long you have been here. It says what you paid for — never that you are
          verified, which is a separate check and a separate mark.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {STANDARD_TERMS.map((option) => (
            <Badge key={option.term} variant="outline" className={option.badge.className}>
              {option.badge.label}
              <span className="ml-1 opacity-70">{option.label}</span>
            </Badge>
          ))}
        </div>
      </section>

      {/* Franchise, apart from the ladder, because it genuinely is. */}
      <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Franchise</h2>
          <Badge variant="outline" className={BADGES.y1.className}>
            Franchise Partner
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          A franchise runs outlets, sources across a district and onboards farmers, so it is
          priced as a partnership rather than a subscription. The first year covers the work of
          coming on — connecting outlets, training staff, covering a district — which happens once.
        </p>
        <div className="flex flex-wrap gap-6 pt-1">
          <div className="flex flex-col">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(FRANCHISE_FIRST_YEAR)}
            </span>
            <span className="text-muted-foreground text-xs">first year</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(FRANCHISE_RENEWAL)}
            </span>
            <span className="text-muted-foreground text-xs">every year after</span>
          </div>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href={`/${locale}/signup?as=franchise`}>
            Register as a franchise
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="bg-secondary flex flex-col gap-2 rounded-xl px-6 py-5">
        <h2 className="font-medium">How you pay</h2>
        <p className="text-muted-foreground text-sm">
          Card and UPI through Razorpay, in your console, and you are on immediately. Paying by
          bank transfer works too — you are given a reference and operations switch you on once it
          clears, usually the same working day.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href={`/${locale}/signup?as=farmer`}>
            Register free
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/${locale}/signin`}>Sign in</Link>
        </Button>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <InfinityIcon className="size-4 text-violet-600" />
          {formatMoney(lifetime.price)} once, and never again
        </span>
      </div>
    </div>
  );
}
