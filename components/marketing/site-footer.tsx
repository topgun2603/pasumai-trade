import { ArrowRightIcon, CheckIcon, MailIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";

/**
 * The last thing on the page, and the only place the terms are stated plainly.
 *
 * Every line under "How this works" is a rule the code actually enforces, not
 * marketing copy that happens to sound reassuring:
 *
 *  - Browsing is free and trading is not — `FREE_CAPABILITIES` in
 *    `lib/domain/subscription.ts`, and the 402 that `requireCapability` returns.
 *  - Accounts are verified first — `lib/domain/readiness.ts`.
 *  - The platform never sets a price — there is no code path that proposes one;
 *    `Party` in `lib/domain/negotiation.ts` has exactly two values.
 *  - Nothing binds until somebody accepts — `canAccept`, and the guard that
 *    stops a party accepting their own proposal.
 *  - A lot can be sold in parts — `lib/domain/partial-bargain.ts`.
 *  - Messages come from a fixed list — `lib/domain/bargain-vocabulary.ts`.
 *
 * Stating them here rather than on a terms page nobody opens is deliberate. A
 * farmer deciding whether this is worth a subscription is asking exactly these
 * questions, and the honest answers are short enough to fit at the bottom of
 * the page they are already on.
 *
 * Six languages, because the footer is where somebody checks whether the
 * platform is really for them. A page whose terms are only in English is a page
 * that means them only for the people who read English.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const columns = [
    {
      title: t.footer.platform,
      links: [
        /*
          Named with the page, not as a bare hash. The footer appears on the
          pricing page too, where `#farmers` points at a section that is not
          there — the link would simply do nothing. This is a server component
          with no idea which page it is on, so it always says home; Next treats
          that as a scroll when it already is home.
        */
        { href: `/${locale}#how-it-works`, label: t.nav.howItWorks },
        { href: `/${locale}#farmers`, label: t.nav.forFarmers },
        { href: `/${locale}#buyers`, label: t.nav.forBuyers },
        { href: `/${locale}#coverage`, label: t.nav.coverage },
        { href: `/${locale}/pricing`, label: t.nav.pricing },
      ],
    },
    {
      title: t.footer.signIn,
      links: [
        { href: `/${locale}/signin?as=buyer`, label: t.footer.buyerOrFranchise },
        // Off the locale tree and out of the marketing chrome: the console
        // has its own door, and it is English-only like the console itself.
        { href: "/admin/login", label: t.footer.operations },
        { href: `/${locale}/signin`, label: t.footer.allOptions },
      ],
    },
  ];

  const terms = [
    t.footer.termFree,
    t.footer.termPlan,
    t.footer.termVerify,
    t.footer.termPrice,
    t.footer.termGrade,
    t.footer.termBinding,
    t.footer.termPartial,
    t.footer.termLanguage,
  ];

  return (
    <footer className="border-t">
      {/*
        The one thing worth asking for at the bottom of the page, and the two
        halves of the answer side by side: it is free to join, and it is not
        free to trade. Saying both in the same breath is the point — a call to
        action that hides the paywall until after signup is how somebody arrives
        at the console feeling misled.
      */}
      <div className="bg-muted/40 border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-medium tracking-tight">{t.footer.joinTitle}</p>
            <p className="text-muted-foreground max-w-lg text-sm">{t.footer.joinBody}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild>
              <Link href={`/${locale}/signup`}>
                {t.footer.registerCta}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/pricing`}>{t.footer.seePlans}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-x-8 gap-y-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <BrandLockup
            name={t.brand.name}
            tagline={t.brand.tagline}
            markClassName="size-10"
            nameClassName="text-base"
          />

          <p className="text-muted-foreground max-w-xs text-sm">{t.footer.tagline}</p>

          <address className="flex flex-col gap-2.5 not-italic">
            <span className="text-muted-foreground flex items-start gap-2 text-sm">
              <MapPinIcon className="mt-0.5 size-4 shrink-0" />
              {t.footer.address}
            </span>
            <a
              href={`mailto:${t.footer.email}`}
              className="text-primary hover:text-primary/80 flex items-center gap-2 text-sm transition-colors"
            >
              <MailIcon className="size-4 shrink-0" />
              {t.footer.email}
            </a>
          </address>
        </div>

        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-sm font-medium">{column.title}</h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/*
          The terms, as a list rather than a paragraph. Somebody scanning for
          "does this cost me anything" should find that line without reading the
          other seven.
        */}
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4">
          <h2 className="text-sm font-medium">{t.footer.termsHeading}</h2>
          <ul className="flex flex-col gap-2">
            {terms.map((term) => (
              <li key={term} className="text-muted-foreground flex items-start gap-2 text-sm">
                <CheckIcon className="text-success mt-0.5 size-3.5 shrink-0" />
                <span>{term}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        Every language the platform speaks, each written in itself. Never show a
        language in another one — somebody who reads only Kannada cannot find
        "Kannada" in a list of English names.
      */}
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-4">
          <span className="text-faint text-xs">{t.footer.languages}</span>
          {LOCALES.map((code) => (
            <Link
              key={code}
              href={`/${code}`}
              hrefLang={LOCALE_META[code].tag}
              lang={LOCALE_META[code].tag}
              aria-current={code === locale ? "true" : undefined}
              className={
                code === locale
                  ? "text-foreground text-xs font-medium"
                  : "text-muted-foreground hover:text-foreground text-xs transition-colors"
              }
            >
              {LOCALE_META[code].nativeName}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t">
        <div className="text-faint mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs sm:flex-row sm:items-start sm:justify-between">
          <p>
            {/*
              `new Date()` rather than a constant, so the year is right without
              anyone remembering to change it. Read at render on the server,
              where every marketing page is generated.
            */}
            © {new Date().getFullYear()} Pasumai Trade. {t.footer.rights}
          </p>
          <p className="max-w-xl sm:text-right">{t.footer.rateNote}</p>
        </div>
      </div>
    </footer>
  );
}
