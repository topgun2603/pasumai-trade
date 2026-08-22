import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { BrandMark } from "@/components/marketing/brand-mark";
import { ProfileForm } from "@/components/marketing/profile-form";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { readPendingSession, verifySession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false },
};

/**
 * The step between having a login and having an account.
 *
 * On the console side of the app rather than the public site, because this is
 * not marketing — it is the first screen of the platform, and somebody who has
 * just proved a handset should not be handed back to a page with a Register
 * Free button on it.
 *
 * It sits directly under the console root layout rather than inside a role
 * group, because every one of those requires claims and the whole point of
 * this page is that there are none yet.
 *
 * Two redirects, and both matter. A session that already has a role is sent to
 * its console — a signed-in person following a stale link would otherwise be
 * invited to create a second account. No session at all goes to sign in.
 */
export default async function ProfilePage() {
  await connection();

  const full = await verifySession();
  if (full) redirect(HOME_FOR_ROLE[full.claims.role]);

  const pending = await readPendingSession();
  if (!pending) redirect("/en/signin");

  // `+919843011204` reads as a phone number to nobody. Shown the way it was
  // typed into the box upstairs, or empty when Google proved an email instead.
  const digits = pending.phone
    ? pending.phone.replace(/\D/g, "").slice(-10)
    : "";
  const readable = digits ? `${digits.slice(0, 5)} ${digits.slice(5)}` : "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <BrandMark className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Tell us who you are
          </h1>
          <p className="text-muted-foreground text-sm">
            {digits
              ? "Your number is confirmed. This is the last step, and it takes a minute."
              : "Your email is confirmed. This is the last step, and it takes a minute."}
          </p>
        </div>
      </div>

      <ProfileForm mobile={readable} />
    </div>
  );
}
