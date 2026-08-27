import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { SignUpForm } from "@/components/marketing/signup-form";
import { canSelfSignup, type SignupRole } from "@/lib/domain/signup";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // The tab title too, not only what is on the page. A reader with several tabs
  // open picks this one out by its title, and an English one on a Tamil page is
  // the hardest of the six to pick out.
  return { title: getDictionary(locale).signup.title, robots: { index: false } };
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const [{ locale }, { as }] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  // `?as=admin` is not a 404 and not a silent default to buyer — it is the one
  // door this page does not have, and sending them to the operations sign-in
  // says so more usefully than either. There is no sign-up behind it: those
  // accounts are issued internally.
  if (as === "admin") redirect("/admin/login");

  const role: SignupRole = canSelfSignup(as ?? "")
    ? (as as SignupRole)
    : "farmer";
  const t = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white">
          <BrandLogo priority className="size-9" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.signup.title}
          </h1>
          <p className="text-muted-foreground text-sm">{t.signup.subtitle}</p>
        </div>
      </div>

      {/* Keyed for the same reason the sign-in form is: the role pills are
          links, so switching door is a client-side navigation and useState
          would otherwise keep the role — and the half-typed form — from the
          door arrived at first. */}
      <SignUpForm key={role} initial={role} locale={locale} t={t} />
    </div>
  );
}
