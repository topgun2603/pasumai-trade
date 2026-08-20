import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { BrandMark } from "@/components/marketing/brand-mark";
import { ProfileForm } from "@/components/marketing/profile-form";
import { readPendingSession } from "@/lib/auth/session";
import { verifySession } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Create your profile",
  robots: { index: false },
};

/**
 * Where a verified handset becomes an account.
 *
 * Reachable only by somebody holding a session, and only while that session has
 * no role. Both other cases redirect rather than render: arriving with no
 * session at all means the OTP step was skipped, and arriving with a role means
 * the account already exists and this page would offer to create a second.
 */
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await connection();

  // A finished account first: this is the case worth catching, because a
  // signed-in person following an old link would otherwise be invited to
  // register again.
  const full = await verifySession();
  if (full) redirect(HOME_FOR_ROLE[full.claims.role]);

  const pending = await readPendingSession();
  if (!pending?.phone) redirect(`/${locale}/signin`);

  // `+919843011204` reads as a phone number to nobody. Shown the way it was
  // typed into the box upstairs.
  const digits = pending.phone.replace(/\D/g, "").slice(-10);
  const readable = `${digits.slice(0, 5)} ${digits.slice(5)}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <BrandMark className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tell us who you are</h1>
          <p className="text-muted-foreground text-sm">
            Your number is confirmed. This is the last step, and it takes a minute.
          </p>
        </div>
      </div>

      <ProfileForm mobile={readable} locale={locale} />
    </div>
  );
}
