"use client";

import {
  BellIcon,
  GaugeIcon,
  HandshakeIcon,
  HouseIcon,
  ReceiptIcon,
  SproutIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionFooter } from "@/components/auth/session-footer";
import { HOME_FOR_ROLE } from "@/lib/auth/claims";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Separator } from "@/components/ui/separator";
import type { Notification } from "@/lib/domain/notification";
import { BrandLogo } from "@/components/marketing/brand-mark";
import { MobileNav } from "@/components/console/mobile-nav";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * The farmer's console: a rail on a desktop, the app bar's drawer on a phone.
 *
 * It used to carry a bottom bar of its own below `md`, on the argument that
 * this console is used standing in a field on a mid-range Android, one thumb,
 * in sunlight — so the primary navigation should sit where a thumb reaches.
 *
 * That argument was made when the drawer did not exist. It does now, in every
 * console including this one, and a farmer had both: a bar across the bottom
 * and a drawer behind the app bar holding the same destinations and two more.
 * Two navigations for one console is one to remove, and the bottom one is the
 * one that was only ever a shortlist — it could not reach Home or Logistics,
 * which is why the drawer had to list everything anyway.
 */
/*
  Keys, not words. The rail is the one part of a console a farmer reads on every
  screen, so it is the part most worth being in their own language — the label
  is looked up per render from whichever dictionary the cookie chose.
*/
/*
  One list, in the order it appears on screen.

  It was two arrays with a visual gap that never rendered, which made "last"
  ambiguous — last in the second array is not last to a reader. Merged, so the
  order in this file is the order on the rail and in the phone's drawer.

  Every entry carried a `bar` flag while the farm console had a bottom bar of
  its own. It has the same drawer as every other console now, and the drawer
  takes the whole list, so there is nothing left for the flag to decide.
*/
const LINKS = [
  /*
    Home is a welcome page, not the landing page.

    Bug 14 asked for it as the default after every sign-in with a continue
    control into Overview. It is in the rail, and reachable, and it is not what
    a farmer lands on: putting a tap between somebody and their own listings
    every single morning is a cost paid daily for a page read once.
  */
  { href: "/farm/home", key: "home", icon: HouseIcon },
  // Was "Today". Bug 15: it is the role's summary, and Overview is what the
  // rest of the platform calls that.
  { href: "/farm", key: "overview", icon: GaugeIcon, exact: true },
  { href: "/farm/listings", key: "produce", icon: SproutIcon },
  { href: "/farm/bargains", key: "bargains", icon: HandshakeIcon },
  // Bug 16: the same business function is called Logistics everywhere else.
  { href: "/farm/sales", key: "logistics", icon: ReceiptIcon },
  /*
    No Prices item. The chart moved inside History, under My Profile — it is
    something you consult, not a place you work, and a rail item promises a
    destination.
  */
  /*
    No Profile item. It sits behind the person icon in the app bar and in the
    rail's account block, beside the address it describes.

    On a phone the account menu it belongs in is right there in the app bar,
    which is a shorter reach than a rail item and the place somebody looks for
    it anyway.

    A badge is something you glance at rather than navigate by, so notifications
    stay at the end rather than sitting mid-list and dragging the eye past the
    work.
  */
  {
    href: "/farm/notifications",
    key: "notifications",
    icon: BellIcon,
  },
] satisfies ReadonlyArray<{
  href: string;
  key: keyof Dictionary["farm"]["nav"];
  icon: typeof GaugeIcon;
  exact?: boolean;
}>;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function FarmNav({
  farmer,
  session,
  pending,
  notifications,
  locale,
  t,
}: {
  farmer: { name: string; id: string; village: string };
  /** Which login is in use. Not the same fact as whose console this is. */
  session: { email?: string };
  /** Counts shown as badges, e.g. bargains waiting on a reply. */
  pending: Record<string, number>;
  /** The bell in the rail header, read once for the whole console. */
  notifications: { rows: Notification[]; unread: number; capped: boolean };
  /** Chosen by the cookie, resolved on the server. See lib/i18n/console.ts. */
  locale: Locale;
  t: Dictionary;
}) {
  const pathname = usePathname();

  /*
    The rail's links, as the drawer wants them, and all of them — this is the
    whole of a farmer's navigation on a phone now that the bottom bar is gone.
  */
  const drawerLinks = LINKS.map(({ href, key, exact }) => ({
    href,
    label: t.farm.nav[key],
    exact,
  }));

  return (
    <>
      {/*
        The phone's top bar, and the drawer behind it.

        This console had neither. Its rail is `hidden md:flex` and the only
        thing replacing it below that width was a bottom link bar — so on a
        handset a farmer lost the mark, the name, the language control and the
        theme control at the moment they signed in, having had all four on the
        public site a second earlier. The language control is the one that
        mattered: it lives at the foot of the rail, which a farmer on a phone
        never sees, so somebody who picked the wrong language on the way in had
        no way back out of it.

        The drawer is the whole of it now. This console matches the other three
        rather than being the one that is nearly the same, and the drawer lists
        every destination rather than the five a bar had room for.

        The subtitle is the farmer's own name rather than "Farm console". Same
        position and same shape as the others; a farmer recognises their name,
        and they only have the one console to be told about.
      */}
      <MobileNav
        subtitle={farmer.name}
        groups={[{ links: drawerLinks }]}
        pending={pending}
        locale={locale}
        brandName={t.brand.name}
        homeHref={HOME_FOR_ROLE.farmer}
        languageLabel={t.farm.nav.language}
        themeLabel={t.farm.nav.theme}
        session={{ email: session.email, role: "farmer" }}
        profile={{ href: "/farm/account", label: t.console.profile }}
        sessionLabels={{
          signedInAs: t.console.signedInAs,
          signOut: t.console.signOut,
          signingOut: t.console.signingOut,
        }}
      >
        <NotificationBell
          notifications={notifications.rows}
          unread={notifications.unread}
          capped={notifications.capped}
          locale={locale}
          href="/farm/notifications"
        />
      </MobileNav>

      <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="bg-white flex size-8 items-center justify-center rounded-full">
            <BrandLogo className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            {/* Whose console this is, not what kind. The role still shows in
              the footer; the name is what a farmer recognises as theirs, and
              it is already stored in their own script. */}
            <span className="text-faint truncate text-xs">{farmer.name}</span>
          </span>
          {/* In whatever language this console is being read in. */}
          <NotificationBell
            notifications={notifications.rows}
            unread={notifications.unread}
            capped={notifications.capped}
            locale={locale}
            href="/farm/notifications"
          />
        </div>

        <Separator />

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {LINKS.map(({ href, key, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            const waiting = pending[href] ?? 0;

            return (
              <li key={href}>
                <Link
                  href={href}
                  data-tour={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {t.farm.nav[key]}
                  {waiting > 0 ? (
                    <Badge
                      variant="outline"
                      className="border-warning/40 bg-warning-soft text-warning tabular ml-auto px-1.5"
                    >
                      {waiting}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-sidebar-border flex shrink-0 flex-col gap-3 border-t p-3">
          {/*
            The way out of a language you cannot read, on the surface most
            likely to be read in one. It only sets the cookie here — there is
            no locale in a console path to rewrite.
          */}
          <LanguageSwitcher current={locale} label={t.farm.nav.language} />
          <ThemeToggle label={t.farm.nav.theme} />
          {/* The name and village were repeated here, a few centimetres
            below the same name in the header. One is enough. */}
          <Separator />
          <SessionFooter
            email={session.email}
            role="farmer"
            profile={{ href: "/farm/account", label: t.console.profile }}
            labels={{
              signedInAs: t.console.signedInAs,
              signOut: t.farm.page.signOut,
              signingOut: t.farm.page.signingOut,
            }}
          />
        </div>
      </nav>

    </>
  );
}
