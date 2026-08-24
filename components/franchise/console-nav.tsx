"use client";

import {
  ArrowLeftRightIcon,
  BellIcon,
  GaugeIcon,
  HandshakeIcon,
  HouseIcon,
  PackageIcon,
  StoreIcon,
  TruckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionFooter } from "@/components/auth/session-footer";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { MobileNav } from "@/components/console/mobile-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Separator } from "@/components/ui/separator";
import type { Notification } from "@/lib/domain/notification";
import type { Role } from "@/lib/auth/claims";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { BrandMark } from "@/components/marketing/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Buying comes first because it is the daily job, and every buying role does
 * it — a franchise buys produce exactly as an independent buyer does.
 */
const BUYING_LINKS = [
  // Bug 14: in the rail, and not the landing page. See the note in farm-nav.
  { href: "/home", key: "home", icon: HouseIcon },
  { href: "/overview", key: "overview", icon: GaugeIcon, exact: true },
  // Bug 21: "Produce" is what a farmer calls their crop. What a buyer opens is
  // a marketplace.
  { href: "/listings", key: "marketplace", icon: StoreIcon },
  { href: "/bargains", key: "bargains", icon: HandshakeIcon },
  /*
    Orders stays here, against the letter of Bug 21.

    The report puts it under Profile with Subscription and Verification. Those
    are things a buyer sets up once; an order is the work itself, opened every
    day, and burying today's deliveries two clicks deep inside an account area
    would be the navigation complaint in a new place.
  */
  { href: "/orders", key: "orders", icon: PackageIcon },
  /*
    Profile second from the bottom, notifications at the very bottom — the same
    two positions on every console, so somebody moving between roles finds them
    without looking.

    Verification and Subscription live under Profile rather than on the rail,
    which is where the rest of what the platform holds about somebody already
    is.
  */
  { href: "/account", key: "profile", icon: UserRoundIcon },
  { href: "/notifications", key: "notifications", icon: BellIcon },
] satisfies ReadonlyArray<{
  href: string;
  /** A dictionary key, so a rail read in Tamil is a rail written in Tamil. */
  key: keyof Dictionary["console"];
  icon: typeof GaugeIcon;
  exact?: boolean;
}>;

/**
 * The supply side, and a franchise's alone.
 *
 * These used to sit in the same list as the buying links, on a rail every
 * buying role saw. A buyer could open Dispatch and watch loads being assigned,
 * or Farmers and read growers' records — neither of which is theirs. The rail
 * is only half the fix; `(franchise)/layout.tsx` is the part that enforces it.
 */
const FRANCHISE_LINKS = [
  { href: "/franchise/dispatch", key: "dispatch", icon: TruckIcon },
  { href: "/franchise/farmers", key: "farmers", icon: UsersIcon },
] satisfies ReadonlyArray<{
  href: string;
  /** A dictionary key, so a rail read in Tamil is a rail written in Tamil. */
  key: keyof Dictionary["console"];
  icon: typeof GaugeIcon;
  exact?: boolean;
}>;

export function ConsoleNav({
  account,
  locale,
  session,
  pending = {},
  notifications,
}: {
  /** Whose console this is. Named in the rail, like the farm one. */
  account: { name: string };
  locale: Locale;
  session: { email?: string; role: Role };
  /** Counts shown as badges on the rail, keyed by href. */
  pending?: Record<string, number>;
  /** The bell in the rail header, read once for the whole console. */
  notifications: { rows: Notification[]; unread: number; capped: boolean };
}) {
  const pathname = usePathname();
  const t = getDictionary(locale);

  /*
    The same links the rail shows, grouped the same way. Built from the lists
    above rather than restated, so a link added to the rail appears on a phone
    without anybody remembering to add it twice.
  */
  const drawerGroups = [
    {
      label: t.console.buying,
      links: BUYING_LINKS.map(({ href, key }) => ({ href, label: t.console[key] })),
    },
    // Operations see the franchise links here too, matching the rail below —
    // they field the call when a franchise cannot work a screen.
    ...(session.role === "franchise" || session.role === "admin"
      ? [
          {
            label: t.console.yourDistrict,
            links: FRANCHISE_LINKS.map(({ href, key }) => ({ href, label: t.console[key] })),
          },
        ]
      : []),
    // The way into the platform view. On a phone there is no rail footer to
    // put it in, so it goes in the drawer as a group of one rather than being
    // unreachable below `md`.
    ...(session.role === "franchise"
      ? [
          {
            label: "Platform",
            links: [{ href: "/admin", label: t.console.platformView, exact: true }],
          },
        ]
      : []),
  ];

  /*
    Sectioned for a franchise, flat for a buyer. Bug 2.

    The two consoles were the same list of the same links in the same order,
    so the only thing telling a franchise which one they were in was a caption
    above the rail — and the report's complaint was exactly that: no
    role-specific navigation, terminology or modules, just one console wearing
    two names.

    A franchise does two jobs, and now the rail says so. Buying is the work
    they share with every buyer; Franchise is the district — dispatch and the
    growers on it — which no buyer has. A buyer sees one ungrouped list,
    because a heading over a list with nothing to distinguish it from is
    decoration.

    Operations see the franchise sections too: they field the call when a
    franchise cannot work a screen, and need to be looking at the same rail.
  */
  const sectioned = session.role === "franchise" || session.role === "admin";

  // Both arrays share a shape; the union of the two is what a section holds.
  const sections: Array<{
    title?: string;
    links: typeof BUYING_LINKS | typeof FRANCHISE_LINKS;
  }> = sectioned
    ? [
        { title: t.console.buying, links: BUYING_LINKS },
        { title: t.console.yourDistrict, links: FRANCHISE_LINKS },
      ]
    : [{ links: BUYING_LINKS }];

  return (
    <>
      <MobileNav
        console={
          session.role === "franchise" ? "Franchise console" : "Buying console"
        }
        groups={drawerGroups}
        pending={pending}
      >
        <NotificationBell
          notifications={notifications.rows}
          unread={notifications.unread}
          capped={notifications.capped}
          locale="en"
          href="/notifications"
        />
      </MobileNav>

      {/*
        Pinned to the viewport rather than stretched to the page, so the theme
        toggle and account block stay reachable however long the content runs.
      */}
      <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <BrandMark className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            {/* Whose, not what kind. A buyer knows they are a buyer. */}
            <span className="text-faint truncate text-xs">{account.name}</span>
          </span>
          {/* English on this surface, off the same records the farmer reads in
            Tamil — the row stores facts, not a sentence. */}
          <NotificationBell
            notifications={notifications.rows}
            unread={notifications.unread}
            capped={notifications.capped}
            locale="en"
            href="/notifications"
          />
        </div>

        <Separator />

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
          {sections.map((section, at) => (
            <ul key={section.title ?? at} className="flex flex-col gap-0.5">
              {section.title ? (
                <li className="text-faint px-2.5 pt-1 pb-1 text-xs font-medium tracking-wide uppercase">
                  {section.title}
                </li>
              ) : null}
              {section.links.map(({ href, key, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
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
                      {t.console[key]}
                      {waiting > 0 ? (
                        // Capped, because past a point the number stops being a
                        // figure anybody acts on and starts being a smudge.
                        <span className="bg-primary text-primary-foreground ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none font-medium tabular-nums">
                          {waiting > 49 ? "50+" : waiting}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>

        {session.role === "franchise" ? (
          /*
            Read-only sight of the whole platform — every farmer, buyer and
            agency on it, without the buttons. Put in the footer rather than
            the list above because it is a different console, not another page
            of this one, and crossing between the two is a full navigation.
          */
          <div className="border-sidebar-border shrink-0 border-t p-3">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <ArrowLeftRightIcon className="size-4 shrink-0" />
              {t.console.platformView}
            </Link>
          </div>
        ) : null}

        {/*
          Bug 16: Sign out sits bottom-left on every console. It was in the top
          bar here and in the admin shell, and bottom-left on farm and agency —
          the same control in two places depending on which door you came
          through, which is the sort of thing that makes cross-role support
          calls harder than they need to be.
        */}
        {/*
          The same four controls in the same order as the farm rail: the way
          out of a language you cannot read, the theme, then the way out
          altogether. A console that arranges these differently is a console
          somebody has to relearn.
        */}
        <div className="border-sidebar-border flex shrink-0 flex-col gap-3 border-t p-3">
          <LanguageSwitcher current={locale} label={t.console.language} />
          <ThemeToggle label={t.console.theme} />
          <Separator />
          <SessionFooter
            labels={{ signOut: t.console.signOut, signingOut: t.console.signingOut }}
          />
        </div>
      </nav>
    </>
  );
}
