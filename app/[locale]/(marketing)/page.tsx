import {
  BanknoteIcon,
  ClipboardCheckIcon,
  FileCheck2Icon,
  HandshakeIcon,
  MapPinIcon,
  RouteIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SproutIcon,
  TruckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnquiryForm } from "@/components/marketing/enquiry-form";
import { BargainDemo } from "@/components/marketing/bargain-demo";
import { Hero } from "@/components/marketing/hero";
import { Journey } from "@/components/marketing/journey";
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
import { getDictionary, isLocale } from "@/lib/i18n";
import { resolveMedia } from "@/lib/marketing/media";
import { GEOGRAPHY } from "@/lib/mock/locations";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  return {
    title: `${t.hero.titleLine1} ${t.hero.titleAccent} ${t.hero.titleLine2}`,
    description: t.hero.body,
    openGraph: { title: "Pasumai Trade", description: t.hero.body, type: "website" },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

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
  const farmers = places.reduce((total, p) => total + p.farmerCount, 0);
  const districts = new Set(
    places.map((p) => findDistrict(GEOGRAPHY, p.districtId)?.name),
  ).size;

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
      <Hero
        t={t}
        locale={locale}
        districts={districts}
        farmers={farmers}
        villages={places.length}
      />

      {/* Live prices */}
      <section id="prices" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal>
            <LivePrices t={t} />
          </Reveal>
        </div>
      </section>

      {/* How a price is reached. Sits directly after the prices so the
          obvious question — who decided these? — is answered where it is
          asked, rather than three sections later. */}
      <section id="bargaining" className="bg-secondary/40 border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <BargainDemo
            title={t.bargain.title}
            body={t.bargain.body}
            caption={t.bargain.caption}
          />
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
              <Badge variant="secondary" className="w-fit">
                {t.farmers.badge}
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
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
              <Badge variant="secondary" className="w-fit">
                {t.buyers.badge}
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
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
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
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
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                {t.drivers.title}
              </h2>
              <p className="text-muted-foreground">{t.drivers.body}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="bg-accent text-accent-foreground flex size-16 items-center justify-center rounded-2xl">
                <RouteIcon className="size-7" />
              </span>
              <Button asChild size="lg">
                <a href="#apply">{t.drivers.cta}</a>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Coverage */}
      <section id="coverage" className="border-b scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <Reveal className="flex max-w-2xl flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              {t.coverage.title}
            </h2>
            <p className="text-muted-foreground">{t.coverage.body}</p>
          </Reveal>

          <Stagger className="mt-8">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {places.map((place) => (
                <StaggerListItem
                  key={place.id}
                  className="bg-card flex flex-col gap-2 rounded-xl border p-5"
                >
                  <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <MapPinIcon className="size-3.5 shrink-0" />
                    {findDistrict(GEOGRAPHY, place.districtId)?.name}
                  </span>
                  <h3 className="leading-snug font-medium">{place.name}</h3>
                  <p className="text-faint tabular text-sm">
                    {place.farmerCount} {t.coverage.farmers} · {place.pincode}
                  </p>
                </StaggerListItem>
              ))}
            </ul>
          </Stagger>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
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

      {/* Apply */}
      <section id="apply" className="scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              {t.apply.title}
            </h2>
            <p className="text-muted-foreground">{t.apply.body}</p>
            <p className="text-muted-foreground text-sm">
              {t.apply.haveAccount}{" "}
              <Link href={`/${locale}/signin`} className="text-primary hover:underline">
                {t.apply.signInHere}
              </Link>
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-card rounded-xl border p-6">
              <EnquiryForm t={t} />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
