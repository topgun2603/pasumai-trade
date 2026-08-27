import { ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSignInForm } from "@/components/admin/admin-signin-form";
import { BrandLogo } from "@/components/marketing/brand-mark";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { verifySession } from "@/lib/auth/session";
import { resolveMedia } from "@/lib/marketing/media";

/**
 * The operations door.
 *
 * A page of its own, off the public site. Operations used to sign in at
 * `/{locale}/signin?as=admin` — the same six-door form farmers and buyers use,
 * with the console tucked behind one of the tabs. Two things were wrong with
 * that: the one entrance nobody visiting the marketing site can use was
 * advertised on it, and the console's front door inherited the marketing
 * chrome — header, language rail, mandi ticker, chat widget, footer — none of
 * which belongs in front of a staff login.
 *
 * It sits under `(console)` rather than `app/[locale]/`, so it takes the
 * console root layout: English only, `robots: noindex`, no locale segment. That
 * is the same treatment every other console page gets, and it means signing in
 * and landing on `/admin` is not a crossing between two root layouts.
 *
 * Deliberately *outside* `(admin)`, whose layout is the auth gate. A login page
 * behind the gate that redirects to the login page is a loop.
 */
export const metadata: Metadata = {
  title: "Operations sign-in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  // Async in Next 16 — reading it opts this route into request-time rendering.
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  /*
    Already signed in? Then this page has nothing to ask.

    Not a guard — the page is public and has to be, or an expired session would
    have nowhere to land. This is so that following a bookmark to the door while
    a session is live goes through to the work rather than to a form whose only
    honest answer is "you already did this". `verifySession` is memoised per
    request and returns null on a deployment with no Admin credentials, so this
    costs one cookie verification and cannot throw the page away.
  */
  const session = await verifySession();
  if (session) {
    const role = session.claims.role;
    // Operations alone. A franchise used to be sent here too; the shell no
    // longer admits them, so sending them would be one redirect on the way to
    // another.
    redirect(role === "admin" ? "/admin" : HOME_FOR_ROLE[role]);
  }

  // The landscape already in the repository, at the one slot shot wide enough
  // to fill a full-height panel. `resolveMedia` picks the photograph if it is
  // there and the illustration if it is not, so this panel cannot go blank the
  // day the photography is swapped.
  const land = resolveMedia("heroLandscape");

  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/*
        The picture half. Hidden below `lg` rather than stacked above the form:
        on a laptop it is what makes this a front door instead of a form, and on
        a phone it would be a screen of scrolling before the password field.
      */}
      <aside className="bg-rail relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <Image
          src={land.src}
          alt=""
          aria-hidden
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover object-center"
        />
        {/* Two washes, not one. A flat overlay at the strength this type needs
            kills the photograph; a gradient keeps the field readable at the top
            and the copy readable at the bottom. */}
        <div
          aria-hidden
          className="from-rail via-rail/85 to-rail/45 absolute inset-0 bg-gradient-to-t"
        />
        <div
          aria-hidden
          className="from-rail/80 absolute inset-0 bg-gradient-to-br to-transparent"
        />

        <div className="relative flex items-center gap-2.5 px-10 pt-10">
          {/* The leaves are bright against the panel, so the photograph needs
            no treatment here — which is the whole reason it can be used. */}
          <BrandLogo className="size-9" />
          <span className="font-heading text-rail-foreground text-[17px] font-semibold tracking-tight">
            Pasumai Trade
          </span>
        </div>

        <div className="relative flex flex-col gap-5 px-10 pb-12">
          <h2 className="font-heading text-rail-foreground max-w-md text-3xl leading-tight font-bold text-balance">
            The console behind the marketplace
          </h2>
          <p className="text-rail-foreground/75 max-w-md leading-relaxed text-pretty">
            Verification queues, bargains, dispatch, subscriptions and the
            reference data every console reads from — operated from one place,
            for every district on the platform.
          </p>
          {/* Named rather than decorative: whoever is signing in should be able
              to tell from the door whether it is the one they want. */}
          <ul className="text-rail-foreground/70 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {["KYC review", "Bargains & dispatch", "Subscriptions", "Controls"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="bg-rail-foreground/50 size-1 rounded-full"
                  />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </aside>

      {/* The form half. */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="flex w-full max-w-sm flex-col gap-8">
          {/* The mark rides above the heading on a phone, where the panel that
              would otherwise carry it is not drawn. */}
          <div className="flex flex-col gap-4 lg:gap-3">
            <BrandLogo priority className="size-12 lg:hidden" />
            <div className="flex flex-col gap-1.5">
              <span className="text-primary flex items-center gap-1.5 text-xs font-medium tracking-[0.14em] uppercase">
                <ShieldCheckIcon className="size-3.5" />
                Operations
              </span>
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                Sign in to the console
              </h1>
              <p className="text-muted-foreground text-sm">
                Use the work email operations issued you.
              </p>
            </div>
          </div>

          {/*
            `requireConsole` sends people here with `?error=unconfigured` when
            the deployment has no Admin credentials. Said plainly, because
            nobody typing a password can fix it and a generic refusal would
            read as their mistake.
          */}
          {error === "unconfigured" ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>
                This deployment has no Firebase Admin credentials, so no session
                can be verified. Sign-in will fail until they are configured.
              </span>
            </div>
          ) : null}

          <AdminSignInForm />

          <div className="text-muted-foreground flex flex-col gap-2 border-t pt-5 text-xs">
            <p>
              Operations accounts are issued internally. There is no sign-up on
              this door.
            </p>
            <p>
              Not operations?{" "}
              <Link href="/en/signin" className="text-primary hover:underline">
                Sign in as a farmer, buyer, franchise or agency
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
