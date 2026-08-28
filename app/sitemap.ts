import type { MetadataRoute } from "next";

import { DEFAULT_LOCALE, LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

/**
 * Every public page, in every language, with the others named beside it.
 *
 * ## Why this matters more here than on a single-language site
 *
 * A bare `/` redirects by `Accept-Language`, and Googlebot crawls overwhelmingly
 * from the United States sending `en`. Left to the redirect alone it would meet
 * the English page and have no reason to believe five others exist. The footer
 * carries `hrefLang` links to all six, which helps, but a sitemap that names
 * every one of them and cross-references the set is the signal Google actually
 * documents for this.
 *
 * ## Which pages are here
 *
 * Only the two that should be indexed. `/signin` and `/signup` carry
 * `robots: { index: false }`, and listing a page in a sitemap while telling
 * search engines not to index it is a contradiction that gets reported in
 * Search Console as an error rather than quietly ignored.
 *
 * When the price pages land, they extend `ROUTES` — the alternates fall out of
 * the same loop and cannot drift from it.
 */
const ROUTES = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  /*
    Build time, not request time — this file is prerendered, so `new Date()`
    reads once when the site is built. That is the honest answer for pages whose
    copy only changes when the site is rebuilt, and it keeps the sitemap static
    rather than making it a dynamic route recomputed per crawl.
  */
  const lastModified = new Date();

  return LOCALES.flatMap((locale) =>
    ROUTES.map(({ path, changeFrequency, priority }) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      changeFrequency,
      // English is not more important than the others; it is the fallback the
      // rest of the site already treats as default, so `x-default` points at it
      // and the sitemap agrees rather than contradicting.
      priority: locale === DEFAULT_LOCALE ? priority : priority * 0.9,
      alternates: {
        languages: {
          ...Object.fromEntries(
            LOCALES.map((l) => [LOCALE_META[l].tag, `${base}/${l}${path}`]),
          ),
          "x-default": `${base}/${DEFAULT_LOCALE}${path}`,
        },
      },
    })),
  );
}
