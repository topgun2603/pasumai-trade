import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ChatWidget } from "@/components/marketing/chat-widget";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TickerSlot } from "@/components/market/ticker-slot";
import { LoginStrip } from "@/components/marketing/login-strip";
import { SiteHeader } from "@/components/marketing/site-header";
import { getDictionary, isLocale } from "@/lib/i18n";
import { JsonLd } from "@/components/marketing/json-ld";
import { organizationSchema, webSiteSchema } from "@/lib/marketing/seo";

/**
 * The public surface.
 *
 * No auth, and deliberately separate from the consoles: this is the only part
 * of the platform search engines see, and the only part that must keep working
 * if the application server has a bad day.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);

  return (
    <div className="flex min-h-svh flex-col">
      {/*
        On the layout rather than the landing page: these two describe the
        business and the site, which are the same facts on the pricing page and
        the sign-in doors. `@id` ties them together and de-duplicates them for
        anything reading more than one page.
      */}
      <JsonLd data={organizationSchema(t)} />
      <JsonLd data={webSiteSchema(locale, t)} />

      <SiteHeader locale={locale} t={t}>
        <LoginStrip locale={locale} t={t} />
      </SiteHeader>

      {/* Directly under the header, above everything else on every marketing
        page. Agmarknet's figures, not ours — see components/market/mandi-ticker. */}
      <TickerSlot locale={locale} />

      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} t={t} />
      {/*
        On the layout rather than the landing page, so a question can be asked
        from wherever it occurs to somebody — the pricing page and the coverage
        map raise as many as the front door does.
      */}
      <ChatWidget locale={locale} />
    </div>
  );
}
