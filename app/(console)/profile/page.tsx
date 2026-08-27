import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { ProfileForm } from "@/components/marketing/profile-form";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { readPendingSession, verifySession } from "@/lib/auth/session";
import { canSelfSignup, type SignupRole } from "@/lib/domain/signup";

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
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
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

  const role = canSelfSignup(as ?? "") ? (as as SignupRole) : undefined;

  return (
    <div className="flex min-h-svh flex-col">
      {/*
        The console's own bar, not the public site's.

        This cannot be the real dashboard. `readClaims` refuses a role that has
        no account id, because every console query scopes by that id — an agency
        holding a role and no id would read every other agency's workers. So the
        account has to exist before a console can safely render, and this is the
        screen that creates it. What it can do is look like the place it leads
        to rather than like marketing.
      */}
      <header className="bg-sidebar border-sidebar-border flex h-12 shrink-0 items-center gap-2.5 border-b px-4">
        <span className="bg-white flex size-7 items-center justify-center rounded-full">
          <BrandLogo className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Pasumai Trade</span>
          {role ? (
            <span className="text-faint text-xs">{CONSOLE_NAME[role]}</span>
          ) : null}
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {role
              ? `Set up your ${CONSOLE_NAME[role].toLowerCase()}`
              : "Tell us who you are"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {digits
              ? "Your number is confirmed. One more step and your console is open."
              : "Your email is confirmed. One more step and your console is open."}
          </p>
        </div>

        {/*
          The door they came through, carried from sign-in or signup. Asking
          again would be asking a question already answered.

          Not trusted, only defaulted: the endpoint validates the role against
          `canSelfSignup` regardless, and somebody editing the query string only
          registers as something they could have chosen anyway.
        */}
        <ProfileForm mobile={readable} chosen={role} />
      </div>
    </div>
  );
}

/** What each door leads to, said as the console rather than as the role. */
const CONSOLE_NAME: Record<SignupRole, string> = {
  farmer: "Farm console",
  buyer: "Buying console",
  franchise: "Franchise console",
  transport: "Transport console",
  manpower: "Manpower console",
};
