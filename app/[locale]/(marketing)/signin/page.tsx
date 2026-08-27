import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { SignInForm, type Audience } from "@/components/marketing/signin-form";
import { ROLES } from "@/lib/auth/claims";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: getDictionary(locale).signin.title,
    robots: { index: false },
  };
}

/**
 * Everything but operations, who have their own page.
 *
 * Derived from `ROLES` rather than listed, so a seventh role added to the
 * platform appears here without anybody remembering to. The filter is what
 * keeps operations out, and the `Audience` type is what makes it hold.
 */
const AUDIENCES: Audience[] = ROLES.filter(
  (role): role is Audience => role !== "admin",
);

function parseAudience(value: string | undefined): Audience {
  return AUDIENCES.includes(value as Audience) ? (value as Audience) : "buyer";
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  // Async in Next 16 — reading it opts this route into request-time rendering.
  searchParams: Promise<{ as?: string }>;
}) {
  const [{ locale }, { as }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  // Operations moved out to their own door. Redirected rather than silently
  // defaulted to buyer: the old link is in bookmarks, in the footer's history
  // and in whatever internal document told staff where to sign in, and landing
  // them on a buyer form would look like the console had been taken away.
  if (as === "admin") redirect("/admin/login");

  const t = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* The mark itself, in the white circle the header and the console
          rails wear. This page once drew lucide's LeafIcon in a green square,
          which was never the brand; the square came back as a circle only once
          there was a real mark to put in it. The circle keeps the size-14
          footprint the bare mark had, so the heading below it has not moved. */}
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white">
          <BrandLogo priority className="size-9" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.signin.title}</h1>
          <p className="text-muted-foreground text-sm">{t.signin.subtitle}</p>
        </div>
      </div>

      {/* Keyed by the door, so arriving from the rail at a different one
          remounts the form with that role selected.
          
          Without this, clicking Manpower while already on ?as=admin is a
          client-side navigation: the prop changes, the component instance is
          reused, and useState keeps the role it mounted with. Same reason the
          crop and quote dialogs are keyed by their record. */}
      <SignInForm
        key={parseAudience(as)}
        initial={parseAudience(as)}
        locale={locale}
        t={t}
      />
    </div>
  );
}
