"use client";

import {
  BadgeCheckIcon,
  BellIcon,
  ChartColumnIcon,
  CreditCardIcon,
  GaugeIcon,
  HandshakeIcon,
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
import { BrandMark } from "@/components/marketing/brand-mark";
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
const LINKS = [
  { href: "/farm", key: "today", icon: GaugeIcon, exact: true },
  { href: "/farm/listings", key: "produce", icon: SproutIcon },
  { href: "/farm/bargains", key: "bargains", icon: HandshakeIcon },
  { href: "/farm/notifications", key: "notifications", icon: BellIcon },
  { href: "/farm/account", key: "account", icon: UserRoundIcon },
] satisfies ReadonlyArray<{
  href: string;
  key: keyof Dictionary["farm"]["nav"];
  icon: typeof GaugeIcon;
  exact?: boolean;
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
  role,
  session,
  pending,
  notifications,
  locale,
  t,
}: {
  farmer: { name: string; id: string; village: string };
  role: "farmer";
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
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <BrandMark className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            <span className="text-faint text-xs">{t.farm.nav.role}</span>
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
          <li>
            <Link
              href="/farm/sales"
              aria-current={
                isActive(pathname, "/farm/sales") ? "page" : undefined
              }
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive(pathname, "/farm/sales")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <ReceiptIcon className="size-4 shrink-0" />
              {t.farm.nav.sales}
            </Link>
          </li>
          <li>
            <Link
              href="/farm/analytics"
              aria-current={
                isActive(pathname, "/farm/analytics") ? "page" : undefined
              }
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive(pathname, "/farm/analytics")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <ChartColumnIcon className="size-4 shrink-0" />
              {t.farm.nav.prices}
            </Link>
          </li>
          <li>
            <Link
              href="/farm/verification"
              data-tour="/farm/verification"
              aria-current={
                isActive(pathname, "/farm/verification") ? "page" : undefined
              }
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive(pathname, "/farm/verification")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <BadgeCheckIcon className="size-4 shrink-0" />
              {t.farm.nav.verification}
            </Link>
          </li>
          <li>
            <Link
              href="/farm/subscription"
              aria-current={
                isActive(pathname, "/farm/subscription") ? "page" : undefined
              }
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isActive(pathname, "/farm/subscription")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <CreditCardIcon className="size-4 shrink-0" />
              {t.farm.nav.subscription}
            </Link>
          </li>
        </ul>

        <div className="border-sidebar-border flex shrink-0 flex-col gap-3 border-t p-3">
          {/*
            The way out of a language you cannot read, on the surface most
            likely to be read in one. It only sets the cookie here — there is
            no locale in a console path to rewrite.
          */}
          <LanguageSwitcher current={locale} label={t.farm.nav.language} />
          <ThemeToggle label={t.farm.nav.theme} />
          <Separator />
          <div className="flex flex-col leading-tight">
            <span className="truncate text-sm font-medium">{farmer.name}</span>
            <span className="text-faint text-xs">
              {farmer.village} · <span className="font-mono">{farmer.id}</span>
            </span>
          </div>
          <Separator />
          <SessionFooter
            email={session.email}
            role={role}
            labels={{
              signOut: t.farm.page.signOut,
              signingOut: t.farm.page.signingOut,
              role: t.farm.nav.role,
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
        {LINKS.map(({ href, key, icon: Icon, exact }) => {
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
        })}
      </nav>
    </>
  );
}
