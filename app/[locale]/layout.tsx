import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";
import { getDictionary, isLocale, LOCALES, LOCALE_META } from "@/lib/i18n";

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
    // Every page under this layout inherits the template, so the name in the
    // tab is set once, here, in the reader's script.
    title: {
      default: dictionary.brand.name,
      template: `%s · ${dictionary.brand.name}`,
    },
    description: dictionary.footer.tagline,
    alternates: {
      canonical: `/${locale}`,
      // Tells search engines these are translations of one another rather
      // than duplicate pages.
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_META[l].tag, `/${l}`]),
      ),
    },
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
      </body>
    </html>
  );
}
