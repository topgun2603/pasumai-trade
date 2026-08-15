import { LeafIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SignInForm, type Audience } from "@/components/marketing/signin-form";
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

const AUDIENCES: Audience[] = ["buyer", "admin", "agency", "farmer"];

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

  const t = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <LeafIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.signin.title}</h1>
          <p className="text-muted-foreground text-sm">{t.signin.subtitle}</p>
        </div>
      </div>

      <SignInForm initial={parseAudience(as)} locale={locale} t={t} />
    </div>
  );
}
