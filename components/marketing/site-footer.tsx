import { ArrowRightIcon, MailIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";

/**
 * The last thing on the page: who we are, where to go, and in what language.
 *
 * It has been emptied out in two passes. First a "How this works" column —
 * eight ticked lines restating the platform's terms, true and checkable and
 * still eight sentences of small print following a reader around. Then the
 * Platform and Sign in link lists, which repeated the site header directly
 * above them on every page and the call to action directly above them here.
 *
 * What is left is the part a footer is actually for: who this is, where they
 * are, how to reach them, and in what languages. Every destination those lists
 * named is still one click away in the header.
 *
 * Six languages, because the footer is where somebody checks whether the
 * platform is really for them. A page whose footer is only in English is a
 * page that means them only for the people who read English.
 */
export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
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
            <p className="text-lg font-medium tracking-tight">
              {t.footer.joinTitle}
            </p>
            <p className="text-muted-foreground max-w-lg text-sm">
              {t.footer.joinBody}
            </p>
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

      {/* One block, so no grid. This was twelve columns when it held terms and
        two lists of links; a grid laid out for four things and given one is a
        column of text with two thirds of a row beside it. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-12">
        <BrandLockup
          name={t.brand.name}
          tagline={t.brand.tagline}
          markClassName="size-10"
          nameClassName="text-base"
        />

        <p className="text-muted-foreground max-w-xs text-sm">
          {t.footer.tagline}
        </p>

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
