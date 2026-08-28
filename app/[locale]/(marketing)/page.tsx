import {
  BanknoteIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  HandshakeIcon,
  RouteIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SproutIcon,
  TruckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BargainDemo } from "@/components/marketing/bargain-demo";
import { AdSlot } from "@/components/ads/ad-slot";
import { Hero } from "@/components/marketing/hero";
import { Journey } from "@/components/marketing/journey";
import { LanguageBand } from "@/components/marketing/language-band";
import { BackToTop } from "@/components/marketing/back-to-top";
import { CoverageSection } from "@/components/marketing/coverage-section";
import { LivePrices } from "@/components/marketing/live-prices";
import { MediaFrame } from "@/components/marketing/media-frame";
import {
  Reveal,
  Stagger,
  StaggerListItem,
} from "@/components/motion/motion-primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findDistrict } from "@/lib/domain/location";
import { readPlacements } from "@/lib/firebase/ads-read";
import { readCoverage } from "@/lib/firebase/places-read";
import { getDictionary, isLocale } from "@/lib/i18n";
import { JsonLd } from "@/components/marketing/json-ld";
import { faqSchema, localeAlternates } from "@/lib/marketing/seo";
import { resolveMedia } from "@/lib/marketing/media";
import { GEOGRAPHY } from "@/lib/mock/locations";

/**
 * Rebuilt hourly, not on every request.
 *
 * The page reads the database for the three figures under the hero, which
 * without this would make the whole landing page dynamic — the one route where
 * a prerendered response matters most, both for a farmer on a village
 * connection and for anything crawling it. Village and district coverage move
 * when operations edit Controls, and a registration count that is an hour
 * behind is a count nobody can tell from an exact one.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return {
    // The descriptive half only — the locale layout's template appends the
    // brand name, so naming it here would print it twice.
    title: t.seo.title,
    description: t.seo.description,
    alternates: localeAlternates(locale),
    /*
      No `openGraph` block here, deliberately.

      Defining one at this depth *replaces* the object resolved further up
      rather than merging into it — including the `og:image` that
      `[locale]/opengraph-image.tsx` attaches at its own segment. This page had
      an openGraph block naming only a title and a description, and the cost was
      the card image silently vanishing from the one page most likely to be
      shared. Omitting it lets Next fill `og:title` and `og:description` from
      the title and description above, which is what they say anyway.
    */
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Hoisted out of the render expression: React Compiler forbids a clock read
  // inside one, and scheduling has to give the same answer server and client.
  const now = new Date().getTime();

  const t = getDictionary(locale);
  // Villages we collect from. Pickup is at the farm, so the village is the
  // meaningful unit of coverage — not a depot.
  //
  // Ordered by district then name, not by distance: a public page has no
  // visitor location to measure from, and the old "distance from our base"
  // ordering answered a question nobody reading this page had asked.
  const places = [...GEOGRAPHY.places].sort(
    (a, b) =>
      (findDistrict(GEOGRAPHY, a.districtId)?.name ?? "").localeCompare(
        findDistrict(GEOGRAPHY, b.districtId)?.name ?? "",
        "en-IN",
      ) || a.name.localeCompare(b.name, "en-IN"),
  );
  /*
    The three figures under the hero, from the database.

    The seeded geography is now only the fallback — what to say when there are
    no credentials to ask with, or the query fails. A landing page reporting
    nought districts because a read timed out is worse than one showing the
    figures it shipped with.

    `reachToShow` holds each number up to its launch figure until the platform's
    own has caught up. See `SHOWCASE_FLOOR` — that is where to change or switch
    off the floor, and it is the only place the page is not stating a count.
  */
  /*
    The villages the platform actually collects from. The seeded geography is
    the fallback, and when it is what gets shown the section says so — a list a
    farmer may read as "they come to mine" has to be the real one or be
    visibly marked, the same as a price.
  */
  const coverage = await readCoverage(
    places.map((place) => ({
      id: place.id,
      name: place.name,
      districtName: findDistrict(GEOGRAPHY, place.districtId)?.name ?? "",
      pincode: place.pincode,
      farmerCount: place.farmerCount,
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
    })),
  );


  // The ad book, once for the page. Every slot below is filled from this one
  // read — see lib/firebase/ads-read.ts on why it is not a query per slot.
  const placed = await readPlacements({ at: now, surface: "landing", locale });

  const harvestMedia = resolveMedia("harvest");
  const consoleMedia = resolveMedia("console");

  const farmerSteps = [
    { icon: SproutIcon, title: t.farmers.step1Title, body: t.farmers.step1Body },
    { icon: ScaleIcon, title: t.farmers.step2Title, body: t.farmers.step2Body },
    { icon: HandshakeIcon, title: t.farmers.step3Title, body: t.farmers.step3Body },
    { icon: BanknoteIcon, title: t.farmers.step4Title, body: t.farmers.step4Body },
  ];

  const buyerSteps = [
    { icon: ClipboardCheckIcon, title: t.buyers.step1Title, body: t.buyers.step1Body },
    { icon: BanknoteIcon, title: t.buyers.step2Title, body: t.buyers.step2Body },
    { icon: TruckIcon, title: t.buyers.step3Title, body: t.buyers.step3Body },
    { icon: ShieldCheckIcon, title: t.buyers.step4Title, body: t.buyers.step4Body },
  ];

  const trust = [
    { icon: FileCheck2Icon, title: t.trust.item1Title, body: t.trust.item1Body },
    { icon: ScaleIcon, title: t.trust.item2Title, body: t.trust.item2Body },
    { icon: ShieldCheckIcon, title: t.trust.item3Title, body: t.trust.item3Body },
    { icon: TruckIcon, title: t.trust.item4Title, body: t.trust.item4Body },
  ];

  const faq = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
    { q: t.faq.q5, a: t.faq.a5 },
    { q: t.faq.q6, a: t.faq.a6 },
  ];


  return (
    <>
      <AdSlot slotId="landing.banner" placed={placed} />

      <Hero t={t} locale={locale} />

      {/* Live prices */}
      <section id="prices" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal>
            <LivePrices t={t} locale={locale} />
          </Reveal>
        </div>
      </section>

      <AdSlot slotId="landing.afterPrices" placed={placed} />

      {/* How a price is reached. Sits directly after the prices so the
          obvious question — who decided these? — is answered where it is
          asked, rather than three sections later. */}
      <section id="bargaining" className="bg-secondary/40 border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <BargainDemo t={t} />
        </div>
      </section>

      {/* Six languages, shown rather than claimed. */}
      <section id="languages" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal>
            <LanguageBand t={t} />
          </Reveal>
        </div>
      </section>

      {/* How it works, as photographs rather than a diagram. */}
      <section id="how-it-works" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Journey t={t} />
        </div>
      </section>

      {/* Farmers */}
      <section id="farmers" className="border-b scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 py-16 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Reveal className="flex flex-col gap-5">
              <span className="text-muted-foreground flex items-center gap-3 text-xs font-medium tracking-[0.18em] uppercase">
                <span aria-hidden className="tabular text-primary">04</span>
                <span aria-hidden className="bg-border h-px w-8" />
                {t.farmers.badge}
              </span>
              <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
                {t.farmers.title}
              </h2>
              <p className="text-muted-foreground">{t.farmers.body1}</p>
              <p className="text-muted-foreground">{t.farmers.body2}</p>
            </Reveal>

            <MediaFrame
              src={harvestMedia.src}
              alt={t.farmers.imageAlt}
              aspect={harvestMedia.aspect}
              isPhotograph={harvestMedia.isPhotograph}
              sizes="(min-width: 1024px) 32rem, 100vw"
            />
          </div>

          <Stagger>
            <ul className="grid gap-4 sm:grid-cols-2">
              {farmerSteps.map((step) => (
                <StaggerListItem
                  key={step.title}
                  className="bg-card flex flex-col gap-2 rounded-xl border p-5"
                >
                  <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
                    <step.icon className="size-4.5" />
                  </span>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </StaggerListItem>
              ))}
            </ul>
          </Stagger>
        </div>
      </section>

      {/* Buyers */}
      <AdSlot slotId="landing.afterFarmers" placed={placed} />

      <section id="buyers" className="bg-secondary/40 border-b scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 py-16 lg:grid-cols-2">
          <Stagger className="lg:order-last">
            <ul className="grid gap-4 sm:grid-cols-2">
              {buyerSteps.map((step) => (
                <StaggerListItem
                  key={step.title}
                  className="bg-card flex flex-col gap-2 rounded-xl border p-5"
                >
                  <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
                    <step.icon className="size-4.5" />
                  </span>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </StaggerListItem>
              ))}
            </ul>
          </Stagger>

          <div className="flex flex-col gap-5">
            <Reveal className="flex flex-col gap-5">
              <span className="text-muted-foreground flex items-center gap-3 text-xs font-medium tracking-[0.18em] uppercase">
                <span aria-hidden className="tabular text-primary">05</span>
                <span aria-hidden className="bg-border h-px w-8" />
                {t.buyers.badge}
              </span>
              <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
                {t.buyers.title}
              </h2>
              <p className="text-muted-foreground">{t.buyers.body}</p>
            </Reveal>

            <MediaFrame
              src={consoleMedia.src}
              alt={t.buyers.imageAlt}
              aspect={consoleMedia.aspect}
              isPhotograph={consoleMedia.isPhotograph}
              sizes="(min-width: 1024px) 32rem, 100vw"
            />

            <Reveal>
              <Button asChild variant="outline" className="w-fit">
                <Link href={`/${locale}/signin?as=buyer`}>{t.buyers.cta}</Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal className="flex max-w-2xl flex-col gap-3">
            <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
              {t.trust.title}
            </h2>
            <p className="text-muted-foreground">{t.trust.body}</p>
          </Reveal>

          <Stagger className="mt-10">
            <ul className="grid gap-4 sm:grid-cols-2">
              {trust.map((item) => (
                <StaggerListItem
                  key={item.title}
                  className="bg-card flex gap-4 rounded-xl border p-5"
                >
                  <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <item.icon className="size-5" />
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.body}
                    </p>
                  </span>
                </StaggerListItem>
              ))}
            </ul>
          </Stagger>
        </div>
      </section>

      {/* Drivers */}
      <section id="drivers" className="bg-secondary/40 border-b scroll-mt-20">
        <Reveal>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-xl flex-col gap-3">
              <Badge variant="secondary" className="w-fit">
                {t.drivers.badge}
              </Badge>
              <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
                {t.drivers.title}
              </h2>
              <p className="text-muted-foreground">{t.drivers.body}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="bg-accent text-accent-foreground flex size-16 items-center justify-center rounded-2xl">
                <RouteIcon className="size-7" />
              </span>
              {/*
                Straight to the transport door, not to the general enquiry form
                at the foot of the page. A vehicle owner reading this already
                knows what they are: sending them to a form that then asks
                whether they want to buy or to sell is asking a question they
                have just answered by clicking.
              */}
              <Button asChild size="lg">
                <Link href={`/${locale}/signin?as=transport`}>{t.drivers.cta}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Coverage */}
      <section id="coverage" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal className="flex max-w-2xl flex-col gap-3">
            <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
              {t.coverage.title}
            </h2>
            <p className="text-muted-foreground">{t.coverage.body}</p>
          </Reveal>

          {/*
            Map and list in one client component, because only the map knows
            whether it drew — and that, not the presence of a key, is what
            decides whether the cards are redundant.
          */}
          <CoverageSection
            cards={coverage.places.map((place) => ({
              id: place.id,
              name: place.name,
              districtName: place.districtName,
              pincode: place.pincode,
              farmerCount: place.farmerCount,
            }))}
            pins={coverage.pins}
            opening={coverage.opening}
            live={coverage.live}
            language={locale}
            labels={{
              farmers: t.coverage.farmers,
              openingSoon: t.coverage.openingSoon,
              unavailable: t.coverage.mapUnavailable,
              regionLabel: t.coverage.mapLabel,
              illustrative: t.coverage.illustrative,
              showList: t.coverage.showList,
              hideList: t.coverage.hideList,
            }}
          />
        </div>
      </section>

      {/* FAQ */}
      {/*
        Beside the questions rather than in the head, so the markup and the copy
        it describes are one edit apart. Google requires every marked-up answer
        to be visible on the page — these are the same six strings the accordion
        below renders, not a second set written for crawlers.
      */}
      <JsonLd data={faqSchema(t)} />

      <section id="faq" className="border-b scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="flex flex-col gap-3">
            <h2 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">
              {t.faq.title}
            </h2>
            <p className="text-muted-foreground">{t.faq.body}</p>
          </Reveal>

          <Reveal delay={0.1}>
            <Accordion type="single" collapsible className="w-full">
              {faq.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/*
        Last in the tree and fixed, so it layers over the page without needing
        a z-index argument with anything above it. The footer is the only thing
        below the coverage map, and this is what gets you back from either.
      */}
      <BackToTop label={t.common.backToTop} />
    </>
  );
}
