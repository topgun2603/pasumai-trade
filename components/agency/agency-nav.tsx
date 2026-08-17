"use client";

import {
  BadgeCheckIcon,
  BuildingIcon,
  CreditCardIcon,
  GaugeIcon,
  HardHatIcon,
  PackageIcon,
  LeafIcon,
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
import type { Role } from "@/lib/auth/claims";
import type { AgencyService } from "@/lib/domain/admin";
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
  { href: "/agency", label: "Overview", icon: GaugeIcon, exact: true },
  {
    // First after the overview: this is the screen an owner keeps open, and a
    // load nobody sees is a load nobody takes.
    href: "/agency/pickups",
    label: "Loads going",
    icon: PackageIcon,
    service: "transport",
  },
  {
    href: "/agency/workers",
    label: "Workers",
    icon: HardHatIcon,
    service: "manpower",
  },
  {
    href: "/agency/fleet",
    label: "Fleet",
    icon: TruckIcon,
    service: "transport",
  },
  {
    href: "/agency/drivers",
    label: "Drivers",
    icon: ShieldCheckIcon,
    service: "transport",
  },
  { href: "/agency/profile", label: "Agency", icon: BuildingIcon },
  { href: "/agency/verification", label: "Verification", icon: BadgeCheckIcon },
  { href: "/agency/subscription", label: "Subscription", icon: CreditCardIcon },
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
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AgencyNav({
  agency,
  service,
  role,
  session,
  pending,
}: {
  agency: { name: string; id: string };
  /** What this login is for. Transport sees fleet and drivers; manpower sees crew. */
  service: AgencyService;
  role: Role;
  session: { email?: string };
  pending: Record<string, number>;
}) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.service || l.service === service);

  return (
    <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <LeafIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">Pasumai Trade</span>
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
        <SessionFooter email={session.email} role={role} />
      </div>
    </nav>
  );
}
