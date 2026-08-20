"use client";

import {
  BadgeCheckIcon,
  BellIcon,
  CreditCardIcon,
  HandshakeIcon,
  PackageIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { Separator } from "@/components/ui/separator";
import type { Notification } from "@/lib/domain/notification";
import type { Role } from "@/lib/auth/claims";
import { BrandMark } from "@/components/marketing/brand-mark";
import { cn } from "@/lib/utils";

/**
 * Buying comes first because it is the daily job, and every buying role does
 * it — a franchise buys produce exactly as an independent buyer does.
 */
const BUYING_LINKS = [
  { href: "/listings", label: "Produce", icon: StoreIcon },
  { href: "/bargains", label: "Bargains", icon: HandshakeIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
  { href: "/orders", label: "Orders", icon: PackageIcon },
  { href: "/verification", label: "Verification", icon: BadgeCheckIcon },
  { href: "/subscription", label: "Subscription", icon: CreditCardIcon },
];

/**
 * The supply side, and a franchise's alone.
 *
 * These used to sit in the same list as the buying links, on a rail every
 * buying role saw. A buyer could open Dispatch and watch loads being assigned,
 * or Farmers and read growers' records — neither of which is theirs. The rail
 * is only half the fix; `(franchise)/layout.tsx` is the part that enforces it.
 */
const FRANCHISE_LINKS = [
  { href: "/franchise/dispatch", label: "Dispatch", icon: TruckIcon },
  { href: "/franchise/farmers", label: "Farmers", icon: UsersIcon },
];

export function ConsoleNav({
  session,
  pending = {},
  notifications,
}: {
  session: { email?: string; role: Role };
  /** Counts shown as badges on the rail, keyed by href. */
  pending?: Record<string, number>;
  /** The bell in the rail header, read once for the whole console. */
  notifications: { rows: Notification[]; unread: number; capped: boolean };
}) {
  const pathname = usePathname();

  /*
    Operations see the franchise links too, because they field the call when a
    franchise cannot work a screen and need to be looking at the same rail.
  */
  const links =
    session.role === "franchise" || session.role === "admin"
      ? [...BUYING_LINKS, ...FRANCHISE_LINKS]
      : BUYING_LINKS;

  return (
    // Pinned to the viewport rather than stretched to the page, so the theme
    // toggle and account block stay reachable however long the content runs.
    <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <BrandMark className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">Pasumai Trade</span>
          <span className="text-faint text-xs">Franchise console</span>
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

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {links.map(({ href, label, icon: Icon }) => {
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
                {label}
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
    </nav>
  );
}
