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
import { getDictionary, isLocale } from "@/lib/i18n";

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

  const dictionary = getDictionary(locale);

  const ladder = STANDARD_TERMS.filter((t) => !t.highlight);
  const lifetime = STANDARD_TERMS.find((t) => t.highlight)!;

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 py-16">
      {/*
        A single wash of colour behind the top of the page. Pinned to the
        viewport width rather than the container so it reads as light on the
        page and not as a box somebody drew, and inert so it never eats a click.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 left-1/2 size-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        {/* Warm gold beside the brand green, where a violet wash used to sit.
            Two unrelated hues over a page that is otherwise green read as a
            gradient somebody left on by accident. */}
        <div className="absolute -top-24 right-[8%] size-[380px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <header className="flex max-w-2xl flex-col gap-5">
        <span className="border-border bg-card/70 text-muted-foreground w-fit rounded-full border px-3 py-1 text-xs backdrop-blur">
          From ₹199 a month · ₹4,999 once
        </span>
        <h1 className="font-heading text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Looking is free.
          <br />
          <span className="text-primary">Trading</span> is what you pay for.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          One price list for farmers, buyers, transport and crew. The longer the term, the less it
          costs a month — and every term buys exactly the same thing.
        </p>
      </header>

      {/*
        The free tier stated before any price. Somebody deciding whether to
        register needs to know what they get for nothing, and burying it under
        seven cards would read as though registration itself costs money.
      */}
      <section className="border-primary/20 bg-accent/60 relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 font-medium">
            <span className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded-full">
              <EyeIcon className="size-3.5" />
            </span>
            Free, with any account
          </span>
          <p className="text-muted-foreground max-w-md text-sm">
            No card, no trial clock. Registration takes a minute and costs nothing.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2">
          {[
            ...FREE_CAPABILITIES.map((c) => CAPABILITY_LABELS[c]),
            "Every settled price, grade by grade",
            "Search farmers, buyers and agencies",
          ].map((line) => (
            <li
              key={line}
              className="bg-background/70 text-foreground/80 rounded-full px-3 py-1 text-xs"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-3xl tracking-tight">Choose a term</h2>
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
            Posting, bargaining, ordering and dispatch — all of it, on every term. A longer term is
            cheaper per month and carries a higher badge, and buys nothing else. The bar under each
            price is that month&rsquo;s cost against paying monthly.
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

        <div className="flex flex-col gap-5 pt-2">
          <div className="flex items-center gap-4">
            <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              or stop paying altogether
            </span>
            <span className="to-border h-px flex-1 bg-gradient-to-r from-transparent" />
          </div>
          <div>
            <PlanCard
              option={lifetime}
              footer={
                <Button asChild className="w-full bg-stone-800 text-white hover:bg-stone-900 focus-visible:ring-stone-500 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100">
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
      <section className="border-border bg-card/50 flex flex-col gap-3 rounded-2xl border p-6">
        <h2 className="font-heading text-2xl tracking-tight">What you wear</h2>
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
      <section className="border-primary/25 relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.07] to-transparent p-6">
        <span
          className="from-primary absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-emerald-500"
          aria-hidden
        />
        <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
          <h2 className="font-heading text-2xl tracking-tight">Franchise</h2>
          <Badge variant="outline" className={BADGES.y1.className}>
            Franchise Partner
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          A franchise runs outlets, sources across a district and onboards farmers, so it is
          priced as a relationship rather than a subscription. The first year covers the work of
          coming on — connecting outlets, training staff, covering a district — which happens at requests.
        </p>
        <div className="flex flex-wrap items-end gap-8 pt-1">
          <div className="flex flex-col">
            <span className="font-heading text-4xl leading-none tracking-tight tabular-nums">
              {formatMoney(FRANCHISE_FIRST_YEAR)}
            </span>
            <span className="text-muted-foreground pt-1 text-xs">first year</span>
          </div>
          <span className="text-faint pb-2 text-2xl">→</span>
          <div className="flex flex-col">
            <span className="font-heading text-primary text-4xl leading-none tracking-tight tabular-nums">
              {formatMoney(FRANCHISE_RENEWAL)}
            </span>
            <span className="text-muted-foreground pt-1 text-xs">every year after</span>
          </div>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href={`/${locale}/signup?as=franchise`}>
            Register as a franchise
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="bg-secondary/70 flex flex-col gap-2 rounded-2xl px-6 py-5">
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
            {/* From the dictionary, like the header's. Written out here, this
                button stayed English in all six languages. */}
            {dictionary.nav.registerNew}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={`/${locale}/signin`}>Sign in</Link>
        </Button>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <InfinityIcon className="size-4 text-amber-600 dark:text-amber-400" />
          {formatMoney(lifetime.price)} once, and never again
        </span>
      </div>
    </div>
  );
}
