"use client";

import {
  BellIcon,
  GaugeIcon,
  HandshakeIcon,
  HouseIcon,
  ReceiptIcon,
  MoonIcon,
  SproutIcon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionFooter } from "@/components/auth/session-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Separator } from "@/components/ui/separator";
import type { Notification } from "@/lib/domain/notification";
import { BrandLogo } from "@/components/marketing/brand-mark";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * The farmer's console, as a bottom bar on a phone and a rail on a desktop.
 *
 * The other consoles are rails only, because they are operated at a desk all
 * day. This one is used standing in a field on a mid-range Android phone, one
 * thumb, in sunlight — so the primary navigation sits where a thumb reaches and
 * the targets are large. Four destinations, not six: anything that does not
 * earn its place on a phone does not belong here at all.
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
  order in this file is the order on the rail, and `bar` alone decides what a
  thumb can reach.
*/
const LINKS = [
  /*
    Home is a welcome page, not the landing page.

    Bug 14 asked for it as the default after every sign-in with a continue
    control into Overview. It is in the rail, and reachable, and it is not what
    a farmer lands on: putting a tap between somebody and their own listings
    every single morning is a cost paid daily for a page read once.
  */
  { href: "/farm/home", key: "home", icon: HouseIcon, bar: false },
  // Was "Today". Bug 15: it is the role's summary, and Overview is what the
  // rest of the platform calls that.
  { href: "/farm", key: "overview", icon: GaugeIcon, exact: true, bar: true },
  { href: "/farm/listings", key: "produce", icon: SproutIcon, bar: true },
  { href: "/farm/bargains", key: "bargains", icon: HandshakeIcon, bar: true },
  // Bug 16: the same business function is called Logistics everywhere else.
  { href: "/farm/sales", key: "logistics", icon: ReceiptIcon, bar: false },
  /*
    No Prices item. The chart moved inside History, under My Profile — it is
    something you consult, not a place you work, and a rail item promises a
    destination.
  */
  /*
    Profile second from the bottom, notifications at the very bottom, on every
    console. A badge is something you glance at rather than navigate by, so
    sitting it mid-list drags the eye past the work on the way down.
  */
  { href: "/farm/account", key: "account", icon: UserRoundIcon, bar: true },
  {
    href: "/farm/notifications",
    key: "notifications",
    icon: BellIcon,
    bar: true,
  },
] satisfies ReadonlyArray<{
  href: string;
  key: keyof Dictionary["farm"]["nav"];
  icon: typeof GaugeIcon;
  exact?: boolean;
  /**
   * Whether it earns a place on the bottom bar.
   *
   * The bar has five thumb-sized targets and no more — anything that does not
   * earn one does not belong on a phone's primary navigation at all.
   */
  bar: boolean;
}>;

function ThemeToggle({ label }: { label: string }) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          <span className="ml-6">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

  return (
    <>
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
            labels={{
              signedInAs: t.console.signedInAs,
              signOut: t.farm.page.signOut,
              signingOut: t.farm.page.signingOut,
            }}
          />
        </div>
      </nav>

      {/*
        The phone bar. `pb-[env(safe-area-inset-bottom)]` keeps it clear of the
        home indicator on an iPhone, where a bar flush to the bottom edge puts
        its tap targets under the system gesture area.
      */}
      <nav className="bg-sidebar border-sidebar-border fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        {/* Five targets, not six. Home is in the rail and not here — see `bar`. */}
        {LINKS.filter((link) => link.bar).map(
          ({ href, key, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            const waiting = pending[href] ?? 0;

            return (
              <Link
                key={href}
                href={href}
                data-tour={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {t.farm.nav[key]}
                {waiting > 0 ? (
                  <span className="bg-warning text-warning-foreground absolute top-1.5 right-1/2 mr-2 flex size-4 items-center justify-center rounded-full text-[10px]">
                    {waiting}
                  </span>
                ) : null}
              </Link>
            );
          },
        )}
      </nav>
    </>
  );
}
