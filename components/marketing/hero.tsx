import {
  HandshakeIcon,
  LeafIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CountUp, Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n";
import { resolveMedia } from "@/lib/marketing/media";

/**
 * The hero, and the four claims under it.
 *
 * Follows the design sheet: a farmer standing against the field, a wash of
 * landscape behind the whole band, and a strip of four short promises sitting
 * across the seam into the next section.
 *
 * Every claim in that strip is one the product actually keeps, and each links
 * to the section that shows how. A row of adjectives nobody can check is the
 * usual failure of a page like this — and on a platform asking farmers to
 * trust it with a harvest, it is the expensive kind of failure.
 */
export function Hero({
  t,
  locale,
  districts,
  farmers,
  villages,
}: {
  t: Dictionary;
  locale: Locale;
  districts: number;
  farmers: number;
  villages: number;
}) {
  const farmer = resolveMedia("heroFarmer");
  const land = resolveMedia("heroLandscape");

  const promises = [
    {
      icon: HandshakeIcon,
      title: t.promises.fairTitle,
      body: t.promises.fairBody,
      href: "#bargaining",
    },
    {
      icon: ShieldCheckIcon,
      title: t.promises.gradedTitle,
      body: t.promises.gradedBody,
      href: "#how-it-works",
    },
    {
      icon: UsersRoundIcon,
      title: t.promises.networkTitle,
      body: t.promises.networkBody,
      href: "#coverage",
    },
    {
      icon: LeafIcon,
      title: t.promises.paidTitle,
      body: t.promises.paidBody,
      href: "#trust",
    },
  ];

  return (
    <section className="relative isolate">
      {/* The landscape sits behind the whole band, washed out so type stays
          readable over it at every width. Decorative: the farmer image below
          carries the alt text. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Image
          src={land.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-35 dark:opacity-20"
        />
        <div className="from-background via-background/85 to-background/40 absolute inset-0 bg-gradient-to-r" />
        <div className="from-background absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t to-transparent" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-end gap-8 px-5 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <Stagger immediate className="flex flex-col items-start gap-6 pb-12 lg:pb-20">
          <StaggerItem>
            <Badge
              variant="outline"
              className="border-primary/30 bg-accent text-accent-foreground"
            >
              {fill(t.hero.badge, { districts, farmers })}
            </Badge>
          </StaggerItem>

          <StaggerItem>
            <h1 className="font-heading max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t.hero.titleLine1}
              <br />
              <span className="text-primary">{t.hero.titleAccent}</span>{" "}
              {t.hero.titleLine2}
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty">
              {t.hero.body}
            </p>
          </StaggerItem>

          <StaggerItem className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#apply">{t.nav.requestAccount}</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/${locale}/signin`}>{t.nav.signIn}</Link>
            </Button>
          </StaggerItem>

          <StaggerItem>
            <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
              {[
                { value: villages, label: t.hero.statPoints },
                { value: districts, label: t.hero.statDistricts },
                { value: farmers, label: t.hero.statFarmers },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <dd className="tabular text-primary text-2xl font-semibold">
                    <CountUp value={stat.value} />
                  </dd>
                  <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </StaggerItem>
        </Stagger>

        {/* An arch rather than a rectangle. Every page in this market frames
            its farmer in a rounded box; the shape is the cheapest way to look
            like nobody else, and it echoes a doorway, which is where produce
            actually changes hands. */}
        <div className="relative hidden self-end justify-self-center lg:block">
          <div className="border-primary/15 relative aspect-[3/4] w-[26rem] overflow-hidden rounded-t-full rounded-b-3xl border-4 shadow-2xl">
            <Image
              src={farmer.src}
              alt={t.hero.imageAlt}
              fill
              priority
              sizes="26rem"
              className="object-cover object-top"
            />
          </div>

          {/* The signature object: three grades, one card. It recurs down the
              page, so the reader meets it before it has to carry meaning. */}
          <div className="bg-card/95 absolute -bottom-4 -left-10 w-56 rounded-xl border p-3.5 shadow-xl backdrop-blur">
            <div className="flex items-baseline justify-between pb-2">
              <span className="text-xs font-medium">{t.hero.cardCrop}</span>
              <span className="text-success text-[10px] font-medium tracking-wide uppercase">
                {t.hero.cardSettled}
              </span>
            </div>
            <dl className="flex flex-col gap-1">
              {[
                ["A", "₹24"],
                ["B", "₹19.50"],
                ["C", "₹13.50"],
              ].map(([grade, rate]) => (
                <div key={grade} className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground text-xs">
                    {t.hero.cardGrade} {grade}
                  </dt>
                  <dd className="tabular text-sm font-semibold">{rate}</dd>
                </div>
              ))}
            </dl>
            <p className="text-faint border-border mt-2.5 border-t pt-2 text-[10px] leading-tight">
              {t.hero.cardNote}
            </p>
          </div>
        </div>
      </div>

      {/* The four promises, straddling the seam. */}
      <div className="mx-auto w-full max-w-6xl px-5 pb-14">
        <ul className="bg-card/90 grid gap-px overflow-hidden rounded-2xl border shadow-sm backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
          {promises.map(({ icon: Icon, title, body, href }) => (
            <li key={title} className="bg-card">
              <a
                href={href}
                className="hover:bg-secondary/60 focus-visible:ring-ring flex h-full flex-col gap-2 p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2"
              >
                <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full">
                  <Icon className="size-5" />
                </span>
                <span className="mt-1 font-medium">{title}</span>
                <span className="text-muted-foreground text-sm leading-snug">
                  {body}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
