import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Analytics } from "@vercel/analytics/next";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";
import { getDictionary, isLocale, LOCALES, LOCALE_META } from "@/lib/i18n";
import { siteUrl } from "@/lib/site-url";

import "../globals.css";

/**
 * Root layout for the public site, one instance per language.
 *
 * `generateStaticParams` prerenders every locale at build time, so each
 * language gets its own static HTML with the correct `lang` on `<html>`. That
 * is what keeps the marketing pages fast and separately indexable — a cookie
 * would have forced request-time rendering and left search engines one page.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e120e" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dictionary = getDictionary(locale);

  return {
    /*
      The origin every relative URL in this tree is resolved against.

      Without it, `canonical: "/ta"` and the generated Open Graph image are
      emitted as relative paths — which a browser resolves fine and a crawler or
      a social scraper does not, because they are reading the markup out of
      context. It was missing, so both were quietly useless.

      `siteUrl()` already prefers a configured domain over Vercel's production
      domain over the per-deployment URL, which is exactly the order wanted
      here: a preview build must not advertise itself as canonical.
    */
    metadataBase: new URL(siteUrl()),

    // Every page under this layout inherits the template, so the name in the
    // tab is set once, here, in the reader's script.
    title: {
      default: dictionary.brand.name,
      template: `%s · ${dictionary.brand.name}`,
    },
    description: dictionary.footer.tagline,

    /*
      Canonical and hreflang are NOT set here.

      They used to be, and inheritance made them wrong: every page under this
      layout claimed `/${locale}` as its canonical, so `/ta/pricing` told search
      engines it was a duplicate of the Tamil home page. Each page declares its
      own now, via `localeAlternates`.
    */

    /*
      Set here rather than on each page, because this is the segment
      `opengraph-image.tsx` sits in — the generated card is merged into whatever
      Open Graph object resolves at this level, and a page that declares its own
      further down replaces the whole thing, image included.

      No `title` or `description`: leaving them out lets each page's own fill
      `og:title` and `og:description`, so the card carries that page's words
      instead of one shared line.
    */
    openGraph: {
      type: "website",
      siteName: dictionary.brand.name,
      locale: LOCALE_META[locale].tag,
    },

    // Twitter falls back to the Open Graph tags for everything except the card
    // shape, and the default shape is a small square thumbnail. The generated
    // card is 1200×630 and wants the wide one.
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // An unknown segment here is a 404, not a fallback to English. Silently
  // serving English at /xx would let bad URLs accumulate and be indexed.
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={LOCALE_META[locale].tag}
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>

        {/*
          Page views and Web Vitals, from Vercel rather than a third-party tag.

          Inside <body> and last: it renders no markup, so it cannot affect
          layout, and the script it injects is deferred — nothing here competes
          with the page for a farmer on a village connection.

          Both root layouts carry it. This application has two — the public site
          under [locale] and the consoles under (console) — and analytics on
          only one of them would measure the front door while ignoring
          everything people actually signed in to do.
        */}
        <Analytics />
      </body>
    </html>
  );
}
