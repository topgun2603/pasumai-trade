"use client";

import {
  BadgeCheckIcon,
  ArrowLeftRightIcon,
  BuildingIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  GaugeIcon,
  HardHatIcon,
  LeafIcon,
  MoonIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SunIcon,
  TractorIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SessionFooter } from "@/components/auth/session-footer";
import type { Role } from "@/lib/auth/claims";
import { cn } from "@/lib/utils";

/** Counts of what is waiting, keyed by href. */
export type PendingCounts = Record<string, number>;

interface NavLink {
  href: string;
  label: string;
  icon: typeof GaugeIcon;
  exact?: boolean;
}

/**
 * Grouped, because the rail had grown to eight peers with no relationship
 * between them.
 *
 * Transportation is the one grouping that earns its place: a driver, a vehicle
 * and a crew are not three kinds of record, they are the three things a
 * dispatch needs at once, and a run is blocked if any of them is missing.
 */
const SECTIONS: Array<{ title?: string; links: NavLink[] }> = [
  {
    links: [
      { href: "/admin", label: "Overview", icon: GaugeIcon, exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumnIcon },
    ],
  },
  {
    title: "Accounts",
    links: [
      { href: "/admin/kyc", label: "KYC review", icon: BadgeCheckIcon },
      { href: "/admin/buyers", label: "Buyers", icon: UserRoundIcon },
      { href: "/admin/farmers", label: "Farmers", icon: TractorIcon },
    ],
  },
  {
    title: "Transportation",
    links: [
      { href: "/admin/transport/agencies", label: "Agencies", icon: BuildingIcon },
      {
        href: "/admin/transport/drivers",
        label: "Drivers",
        icon: ShieldCheckIcon,
      },
      { href: "/admin/transport/vehicles", label: "Vehicles", icon: TruckIcon },
      {
        href: "/admin/transport/manpower",
        label: "Manpower",
        icon: HardHatIcon,
      },
    ],
  },
  {
    title: "Trade",
    links: [
      { href: "/admin/listings", label: "Listings", icon: ClipboardListIcon },
      {
        href: "/admin/controls",
        label: "Controls",
        icon: SlidersHorizontalIcon,
      },
    ],
  },
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

export function AdminNav({
  pending,
  session,
}: {
  pending: PendingCounts;
  session: { email?: string; role: Role };
}) {
  const pathname = usePathname();

  return (
    // Pinned to the viewport rather than stretched to the page. Without this
    // the rail grows with the content, and on a long page — analytics, the
    // controls catalogue — the theme toggle and account block end up far below
    // the fold. `h-svh` uses the small viewport height so a mobile browser's
    // collapsing address bar cannot push the footer out of reach.
    <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-md">
          <LeafIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">Pasumai Trade</span>
          <span className="text-faint text-xs">Platform admin</span>
        </span>
      </div>

      <Separator />

      {/* Takes the slack and scrolls on its own, so the footer below stays
          put however many sections are added. */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
        {SECTIONS.map((section, index) => (
          <ul key={section.title ?? index} className="flex flex-col gap-0.5">
            {section.title ? (
              <li className="text-faint px-2.5 pt-1 pb-1 text-xs font-medium tracking-wide uppercase">
                {section.title}
              </li>
            ) : null}
            {section.links.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              const waiting = pending[href] ?? 0;

              return (
                <li key={href}>
                  <Link
                    href={href}
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
        ))}
      </div>

      <div className="border-sidebar-border shrink-0 border-t p-3 flex flex-col gap-3">
        <Link
          href="/listings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeftRightIcon className="size-4 shrink-0" />
          Buyer console
        </Link>
        <ThemeToggle />
        <Separator />
        <SessionFooter email={session.email} role={session.role} />
      </div>
    </nav>
  );
}
