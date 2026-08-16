import { LeafIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

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
  return { title: "Create an account", robots: { index: false } };
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
  // door this page does not have, and sending them to sign in says so more
  // usefully than either.
  if (as === "admin") redirect(`/${locale}/signin?as=admin`);

  const role: SignupRole = canSelfSignup(as ?? "") ? (as as SignupRole) : "farmer";
  const t = getDictionary(locale);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <LeafIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          <p className="text-muted-foreground text-sm">
            Takes a minute. You can sign in and look around straight away.
          </p>
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
