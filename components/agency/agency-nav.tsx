"use client";

import {
  BuildingIcon,
  GaugeIcon,
  HardHatIcon,
  HouseIcon,
  PackageIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  TruckIcon,
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
import { Separator } from "@/components/ui/separator";
import type { AgencyService } from "@/lib/domain/admin";
import { BrandMark } from "@/components/marketing/brand-mark";
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
  label: string;
  icon: typeof GaugeIcon;
  service?: AgencyService;
  exact?: boolean;
}> = [
  // Bug 14: reachable from the rail, and not where sign-in lands.
  { href: "/agency/home", label: "Home", icon: HouseIcon },
  { href: "/agency", label: "Overview", icon: GaugeIcon, exact: true },
  {
    /*
      First after the overview: this is the screen an owner keeps open, and a
      load nobody sees is a load nobody takes.

      Bug 25 renames it. "Loads going" described what the platform was doing;
      "Book Transport" describes what the agency does on the page, which is
      the thing a label is for.
    */
    href: "/agency/pickups",
    label: "Book Transport",
    icon: PackageIcon,
    service: "transport",
  },
  {
    // Bug 25: a manpower agency is not managing a list of workers here, it is
    // taking work.
    href: "/agency/workers",
    label: "Book Orders",
    icon: HardHatIcon,
    service: "manpower",
  },
  {
    // Bug 25: "Fleet" is a word the platform used; the business calls it
    // transport, and so does every other role's console now.
    href: "/agency/fleet",
    label: "Transport",
    icon: TruckIcon,
    service: "transport",
  },
  {
    href: "/agency/drivers",
    label: "Drivers",
    icon: ShieldCheckIcon,
    service: "transport",
  },
  /*
    Bug 25 and Bug 17: verification, subscription and the agency record itself
    stop being three rail items and become one Profile area holding all three.

    "My Profile", the same words as every other console — an agency owner and a
    farmer should not have to learn two names for the same place.
  */
  { href: "/agency/profile", label: "My Profile", icon: BuildingIcon },
];

function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <SunIcon className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          <span className="ml-6">Theme</span>
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

export function AgencyNav({
  agency,
  service,
  pending,
}: {
  agency: { name: string; id: string };
  /** What this login is for. Transport sees fleet and drivers; manpower sees crew. */
  service: AgencyService;
  pending: Record<string, number>;
}) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.service || l.service === service);

  // The same filtered list the rail draws, so a transport-only link never
  // appears in a manpower drawer.
  const drawerGroups = [
    { links: links.map(({ href, label, exact }) => ({ href, label, exact })) },
  ];

  return (
    <>
      <MobileNav
        console={
          service === "manpower" ? "Manpower console" : "Transport console"
        }
        groups={drawerGroups}
        pending={pending}
      />

      <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <BrandMark className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            <span className="text-faint text-xs">Agency console</span>
          </span>
        </div>

        <Separator />

        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {links.map(({ href, label, icon: Icon, exact }) => {
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
                  {label}
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
          <ThemeToggle />
          <Separator />
          <div className="flex flex-col leading-tight">
            <span className="truncate text-sm font-medium">{agency.name}</span>
            <span className="text-faint font-mono text-xs">{agency.id}</span>
          </div>
          <Separator />
          <SessionFooter />
        </div>
      </nav>
    </>
  );
}
