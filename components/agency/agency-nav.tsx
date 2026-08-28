"use client";

import {
  BellIcon,
  GaugeIcon,
  HardHatIcon,
  HouseIcon,
  PackageIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionFooter } from "@/components/auth/session-footer";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { Notification } from "@/lib/domain/notification";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { HOME_FOR_ROLE, type Role } from "@/lib/auth/claims";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AgencyService } from "@/lib/domain/admin";
import { BrandLogo } from "@/components/marketing/brand-mark";
import { MobileNav } from "@/components/console/mobile-nav";
import { cn } from "@/lib/utils";

/**
 * The agency console rail.
 *
 * Only the sections this login is for. A manpower login never sees a Fleet
 * link, because the page behind it would refuse them anyway and a dead link is
 * a worse answer than no link.
 */
const LINKS: Array<{
  href: string;
  /** A dictionary key, so the rail reads in the owner's own language. */
  key: keyof Dictionary["console"];
  icon: typeof GaugeIcon;
  service?: AgencyService;
  exact?: boolean;
}> = [
  // Bug 14: reachable from the rail, and not where sign-in lands.
  { href: "/agency/home", key: "home", icon: HouseIcon },
  { href: "/agency", key: "overview", icon: GaugeIcon, exact: true },
  {
    /*
      First after the overview: this is the screen an owner keeps open, and a
      load nobody sees is a load nobody takes.

      Bug 25 renames it. "Loads going" described what the platform was doing;
      "Book Transport" describes what the agency does on the page, which is
      the thing a label is for.
    */
    href: "/agency/pickups",
    key: "bookTransport",
    icon: PackageIcon,
    service: "transport",
  },
  {
    // Bug 25: a manpower agency is not managing a list of workers here, it is
    // taking work.
    href: "/agency/workers",
    key: "bookOrders",
    icon: HardHatIcon,
    service: "manpower",
  },
  {
    // Bug 25: "Fleet" is a word the platform used; the business calls it
    // transport, and so does every other role's console now.
    href: "/agency/fleet",
    key: "transport",
    icon: TruckIcon,
    service: "transport",
  },
  {
    href: "/agency/drivers",
    key: "drivers",
    icon: ShieldCheckIcon,
    service: "transport",
  },
  /*
    Bug 25 and Bug 17: verification, subscription and the agency record itself
    stop being three rail items and become one Profile area holding all three.

    "My Profile", the same words as every other console — an agency owner and a
    farmer should not have to learn two names for the same place.
  */
  /*
    The console had no notifications at all. An agency learned a load was
    waiting by opening the board and looking, and learned its papers had been
    decided by not being refused any more.
  */
  { href: "/agency/notifications", key: "notifications", icon: BellIcon },
];

export function AgencyNav({
  agency,
  notifications,
  session,
  role,
  service,
  locale,
  pending,
}: {
  agency: { name: string; id: string };
  /** The bell in the rail header, read once for the whole console. */
  notifications: { rows: Notification[]; unread: number; capped: boolean };
  session: { email?: string };
  role: Role;
  locale: Locale;
  /** What this login is for. Transport sees fleet and drivers; manpower sees crew. */
  service: AgencyService;
  pending: Record<string, number>;
}) {
  const pathname = usePathname();
  const t = getDictionary(locale);
  const links = LINKS.filter((l) => !l.service || l.service === service);

  // The same filtered list the rail draws, so a transport-only link never
  // appears in a manpower drawer.
  const drawerGroups = [
    { links: links.map(({ href, key, exact }) => ({ href, label: t.console[key], exact })) },
  ];

  return (
    <>
      {/* Whose, not what kind — the same line the rail below shows. */}
      <MobileNav
        subtitle={agency.name}
        groups={drawerGroups}
        pending={pending}
        locale={locale}
        brandName={t.brand.name}
        homeHref={HOME_FOR_ROLE[service === "manpower" ? "manpower" : "transport"]}
        languageLabel={t.console.language}
        themeLabel={t.console.theme}
        session={{
          email: session.email,
          role: service === "manpower" ? "manpower" : "transport",
        }}
        profile={{ href: "/agency/profile", label: t.console.profile }}
        sessionLabels={{
          signedInAs: t.console.signedInAs,
          signOut: t.console.signOut,
          signingOut: t.console.signingOut,
        }}
      />

      <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="bg-white flex size-8 items-center justify-center rounded-full">
            <BrandLogo className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            {/* Whose, not what kind. */}
            <span className="text-faint truncate text-xs">{agency.name}</span>
          </span>
          <NotificationBell
            notifications={notifications.rows}
            unread={notifications.unread}
            capped={notifications.capped}
            locale={locale}
            href="/agency/notifications"
          />
        </div>

        <Separator />

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {links.map(({ href, key, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
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
          <LanguageSwitcher current={locale} label={t.console.language} />
          <ThemeToggle label={t.console.theme} />
          {/* The name and id were repeated here, under the same name in the
            header. Removed on every console, not just the farm one. */}
          <Separator />
          <SessionFooter
            email={session.email}
            profile={{ href: "/agency/profile", label: t.console.profile }}
            role={role}
            labels={{
              signedInAs: t.console.signedInAs,
              signOut: t.console.signOut,
              signingOut: t.console.signingOut,
            }}
          />
        </div>
      </nav>
    </>
  );
}
