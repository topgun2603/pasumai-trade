"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The way around a console on a phone.
 *
 * Three of the four consoles had none. Their rails are `hidden md:flex` and
 * nothing replaced them below that width, so signing in on a handset gave a
 * buying, agency or admin console with no navigation at all — every page
 * reachable only by typing its address.
 *
 * ## Why a drawer rather than the farm console's bottom bar
 *
 * The farm bar works because a farmer has five destinations. These have eight,
 * nine and sixteen; a bottom bar would either drop most of them or become a row
 * of targets too small to hit, which is the same defect wearing a different
 * shape. A drawer holds all of them and keeps the grouping the desktop rail
 * already uses.
 *
 * The header stays visible so there is always something to open it with, and it
 * carries the console's own name — on a phone, with no rail in view, that is
 * the only thing saying which console this is.
 */

export interface MobileNavGroup {
  /** Optional heading, matching the desktop rail's own grouping. */
  readonly label?: string;
  readonly links: readonly {
    readonly href: string;
    readonly label: string;
    readonly exact?: boolean;
  }[];
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({
  console: consoleName,
  groups,
  pending = {},
  children,
}: {
  /** Which console this is. The only thing naming it once the rail is gone. */
  console: string;
  groups: readonly MobileNavGroup[];
  /** The same badge counts the rail shows, keyed by href. */
  pending?: Record<string, number>;
  /** Anything the console wants on the right — a bell, usually. */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-sidebar border-sidebar-border sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation">
            <MenuIcon className="size-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <span className="bg-white flex size-8 items-center justify-center rounded-full">
                <BrandLogo className="size-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Pasumai Trade</span>
                <span className="text-faint text-xs font-normal">{consoleName}</span>
              </span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-4 overflow-y-auto p-3">
            {groups.map((group, at) => (
              <div key={group.label ?? at} className="flex flex-col gap-0.5">
                {group.label ? (
                  <span className="text-faint px-2.5 pb-1 text-[11px] tracking-wide uppercase">
                    {group.label}
                  </span>
                ) : null}

                {group.links.map((link) => {
                  const active = isActive(pathname, link.href, link.exact);
                  const waiting = pending[link.href] ?? 0;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      // Closed on tap. Without this the drawer stays open over
                      // the page it just navigated to, which reads as a tap
                      // that did nothing.
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {link.label}
                      {waiting > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning-soft text-warning tabular ml-auto px-1.5"
                        >
                          {waiting}
                        </Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">Pasumai Trade</span>
        <span className="text-faint text-xs">{consoleName}</span>
      </span>

      <span className="ml-auto flex items-center gap-1">{children}</span>
    </header>
  );
}
