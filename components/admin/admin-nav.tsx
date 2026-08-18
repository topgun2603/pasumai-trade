"use client";

import {
  BadgeCheckIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  BuildingIcon,
  ChartColumnIcon,
  BellIcon,
  ClipboardListIcon,
  GaugeIcon,
  InboxIcon,
  HardHatIcon,
  LeafIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  TractorIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
      // Above KYC review on purpose: an enquiry is where an account begins, and
      // nobody reaches the KYC queue without first being called back.
      { href: "/admin/enquiries", label: "Enquiries", icon: InboxIcon },
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
      // Revenue was the one thing this console could not see at all.
      { href: "/admin/subscriptions", label: "Subscriptions", icon: BanknoteIcon },
      { href: "/admin/listings", label: "Listings", icon: ClipboardListIcon },
      {
        href: "/admin/controls",
        label: "Controls",
        icon: SlidersHorizontalIcon,
      },
    ],
  },
];


export function AdminNav({ pending }: { pending: PendingCounts }) {
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
      </div>
    </nav>
  );
}
