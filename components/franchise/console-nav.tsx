"use client";

import {
  BadgeCheckIcon,
  CreditCardIcon,
  HandshakeIcon,
  LeafIcon,
  MoonIcon,
  PackageIcon,
  StoreIcon,
  SunIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

/**
 * Buying comes first because it is the daily job. Listings, dispatch and
 * farmers are the supply side, used less often and by fewer people.
 */
const LINKS = [
  { href: "/listings", label: "Produce", icon: StoreIcon },
  { href: "/bargains", label: "Bargains", icon: HandshakeIcon },
  { href: "/orders", label: "Orders", icon: PackageIcon },
  { href: "/dispatch", label: "Dispatch", icon: TruckIcon },
  { href: "/farmers", label: "Farmers", icon: UsersIcon },
  { href: "/verification", label: "Verification", icon: BadgeCheckIcon },
  { href: "/subscription", label: "Subscription", icon: CreditCardIcon },
];

/**
 * The resolved theme is unknown during the server render, so the icon is
 * swapped by CSS off the `.dark` class rather than by React state. That avoids
 * both a hydration mismatch and the mount-gate flash.
 */
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

export function ConsoleNav({
  franchise,
  session,
}: {
  franchise: { name: string; code: string };
  session: { email?: string; role: Role };
}) {
  const pathname = usePathname();

  return (
    // Pinned to the viewport rather than stretched to the page, so the theme
    // toggle and account block stay reachable however long the content runs.
    <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <LeafIcon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">Pasumai Trade</span>
          <span className="text-faint text-xs">Franchise console</span>
        </span>
      </div>

      <Separator />

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-sidebar-border shrink-0 border-t p-3 flex flex-col gap-3">
        <ThemeToggle />
        <Separator />
        <div className="flex flex-col leading-tight">
          <span className="truncate text-sm font-medium">{franchise.name}</span>
          <span className="text-faint font-mono text-xs">{franchise.code}</span>
        </div>
        <Separator />
        <SessionFooter email={session.email} role={session.role} />
      </div>
    </nav>
  );
}
