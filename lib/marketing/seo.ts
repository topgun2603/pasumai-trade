import "server-only";

import type { Metadata } from "next";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";

/**
 * Canonical and hreflang for one page, in every language it exists in.
 *
 * ## Why this is per page rather than on the layout
 *
 * It used to be on the locale layout, which meant every page under it inherited
 * `canonical: "/ta"` — so `/ta/pricing` told search engines it was a duplicate
 * of the Tamil home page and should not be indexed separately. The hreflang set
 * had the same fault: it pointed at six locale *roots* from whatever page it
 * was rendered on. Both are the kind of mistake that costs a page its listing
 * silently, since nothing about the site looks wrong.
 *
 * A path belongs to a page, so the tag that names it does too.
 *
 * ## x-default
 *
 * Six languages all targeting one country is exactly the case Google asks for
 * `x-default`: it says which version to serve somebody whose language matches
 * none of them. It points at English — not because English is more important,
 * but because it is the fallback `matchLocale` already picks, and the two
 * disagreeing would be worse than either choice.
 *
 * Paths are relative; `metadataBase` on the locale layout makes them absolute.
 */
export function localeAlternates(
  locale: Locale,
  path: string = "",
): Metadata["alternates"] {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(
        LOCALES.map((l) => [LOCALE_META[l].tag, `/${l}${path}`]),
      ),
      "x-default": `/${DEFAULT_LOCALE}${path}`,
    },
  };
}

/**
 * The business, for a knowledge panel and for anything that resolves an entity.
 *
 * `@id` is the site root rather than the locale root on purpose: this is one
 * organisation described six times, not six organisations. Giving each language
 * its own identifier would split whatever authority the entity accumulates
 * across six of them.
 *
 * The logo is the 512px installed-app icon — the same mark the application
 * draws, on an opaque ground, which is what Google asks for (it rejects a
 * transparent logo against its own white surfaces).
 */
export function organizationSchema(t: Dictionary): Record<string, unknown> {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "Pasumai Trade",
    alternateName: t.brand.name,
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/icon-512.png`,
      width: 512,
      height: 512,
    },
    description: t.seo.description,
    areaServed: { "@type": "Country", name: "India" },
    knowsLanguage: LOCALES.map((l) => LOCALE_META[l].tag),
  };
}

/**
 * The site itself, tied back to the organisation that publishes it.
 *
 * No `SearchAction`. It describes a search results URL a crawler may offer as a
 * sitelinks searchbox, and there is no public search page to point one at —
 * declaring one that 404s is worse than declaring none.
 */
export function webSiteSchema(
  locale: Locale,
  t: Dictionary,
): Record<string, unknown> {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    url: `${base}/${locale}`,
    name: t.brand.name,
    description: t.seo.description,
    inLanguage: LOCALE_META[locale].tag,
    publisher: { "@id": `${base}/#organization` },
  };
}

/**
 * The landing page's own FAQ, marked up as one.
 *
 * The six questions are already written, already translated into all six
 * languages, and already on the page — this only tells a crawler what it is
 * looking at. Google requires the marked-up answers to be visibly present, and
 * they are: same strings, same accordion, no hidden copy.
 */
export function faqSchema(t: Dictionary): Record<string, unknown> {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    [t.faq.q1, t.faq.a1],
    [t.faq.q2, t.faq.a2],
    [t.faq.q3, t.faq.a3],
    [t.faq.q4, t.faq.a4],
    [t.faq.q5, t.faq.a5],
    [t.faq.q6, t.faq.a6],
  ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
