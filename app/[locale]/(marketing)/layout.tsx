import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getDictionary, isLocale } from "@/lib/i18n";

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
      <SiteHeader locale={locale} t={t} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} t={t} />
    </div>
  );
}
