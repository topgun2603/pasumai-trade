"use client";

import {
  MessageCircleIcon,
  BadgeCheckIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  BuildingIcon,
  ChartColumnIcon,
  BellIcon,
  ClipboardListIcon,
  GaugeIcon,
  HardHatIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  TractorIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionFooter } from "@/components/auth/session-footer";
import { Badge } from "@/components/ui/badge";
import { franchiseMayRead } from "@/lib/auth/admin-access";
import type { Role } from "@/lib/auth/claims";
import { Separator } from "@/components/ui/separator";
import { BrandMark } from "@/components/marketing/brand-mark";
import { MobileNav } from "@/components/console/mobile-nav";
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
      // Second, because it is the answer to "what should I do now" and the rest
      // of the rail is the answer to "where do I go to do it".
      { href: "/admin/notifications", label: "Notifications", icon: BellIcon },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumnIcon },
    ],
  },
  {
    title: "Accounts",
    links: [
      // Above KYC on purpose: somebody typing into the chat is waiting on a
      // reply now, while a document has been told two working days.
      { href: "/admin/chat", label: "Chat", icon: MessageCircleIcon },
      { href: "/admin/kyc", label: "KYC review", icon: BadgeCheckIcon },
      { href: "/admin/buyers", label: "Buyers", icon: UserRoundIcon },
      // Its own entry since the two were separated. Without it three real
      // franchises would be signed in and working with nowhere here to find
      // them.
      { href: "/admin/franchises", label: "Franchises", icon: StoreIcon },
      { href: "/admin/farmers", label: "Farmers", icon: TractorIcon },
    ],
  },
  {
    title: "Transportation",
    links: [
      {
        href: "/admin/transport/agencies",
        label: "Agencies",
        icon: BuildingIcon,
      },
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
      // Revenue was the one thing this console could not see at all.
      {
        href: "/admin/subscriptions",
        label: "Subscriptions",
        icon: BanknoteIcon,
      },
      { href: "/admin/listings", label: "Listings", icon: ClipboardListIcon },
      {
        href: "/admin/controls",
        label: "Controls",
        icon: SlidersHorizontalIcon,
      },
    ],
  },
];

export function AdminNav({
  pending,
  role,
  email,
}: {
  pending: PendingCounts;
  /** Shown above Sign out, so an operator can see which login they are on. */
  email?: string;
  /**
   * Operations sees the whole rail. A franchise sees the read-only part of it,
   * filtered from the same allow-list the `(operations)` route group enforces,
   * so a link cannot appear here for a page that would then refuse them.
   */
  role: Role;
}) {
  const pathname = usePathname();

  const sections = (
    role === "admin"
      ? SECTIONS
      : SECTIONS.map((section) => ({
          ...section,
          links: section.links.filter((link) => franchiseMayRead(link.href)),
        }))
  ).filter((section) => section.links.length > 0);

  /*
    The rail's own sections, reused. Sixteen links is far too many for a bottom
    bar, and the grouping is what makes them navigable — dropping it on a phone
    would leave one undifferentiated list.
  */
  const drawerGroups = sections.map((section) => ({
    label: section.title,
    links: section.links.map(({ href, label, exact }) => ({
      href,
      label,
      exact,
    })),
  }));

  return (
    <>
      <MobileNav
        console={role === "admin" ? "Platform admin" : "Platform view"}
        groups={drawerGroups}
        pending={pending}
      />
      {/*
        Pinned to the viewport rather than stretched to the page. Without this
        the rail grows with the content, and on a long page — analytics, the
        controls catalogue — the theme toggle and account block end up far
        below the fold. `h-svh` uses the small viewport height so a mobile
        browser's collapsing address bar cannot push the footer out of reach.
      */}
      <nav className="bg-sidebar border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-md">
            <BrandMark className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              Pasumai Trade
            </span>
            <span className="text-faint text-xs">
              {role === "admin" ? "Platform admin" : "Platform view"}
            </span>
          </span>
        </div>

        <Separator />

        {/* Takes the slack and scrolls on its own, so the footer below stays
          put however many sections are added. */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
          {sections.map((section, index) => (
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
          {/* The way back. A franchise arrived from their own console and this
            is the only thing on screen that returns them to it. */}
          <Link
            href="/listings"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeftRightIcon className="size-4 shrink-0" />
            {role === "admin" ? "Buyer console" : "Franchise console"}
          </Link>

          {/* Bug 16: bottom-left, the same as every other console. */}
          <SessionFooter email={email} role={role} />
        </div>
      </nav>
    </>
  );
}
