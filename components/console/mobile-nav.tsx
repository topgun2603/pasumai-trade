"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/marketing/brand-mark";
import { SessionFooter } from "@/components/auth/session-footer";
import { ConsoleAppBar } from "@/components/console/app-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/auth/claims";
import type { Locale } from "@/lib/i18n/config";
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
 * carries whose console this is — on a phone, with no rail in view, that is the
 * only thing saying so.
 *
 * That header is `ConsoleAppBar` now rather than markup of its own, so the
 * language and theme controls arrive with it. They were reachable only from the
 * rails, which are `hidden md:flex` — so on a handset the way out of a language
 * you cannot read was not on the screen at all.
 *
 * The account — who is signed in, their profile, and signing out — is at the
 * foot of the drawer rather than in the bar, which is where the rail keeps it
 * and where a thumb reaches.
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
  subtitle,
  groups,
  pending = {},
  locale,
  brandName,
  homeHref,
  languageLabel,
  themeLabel,
  session,
  sessionLabels,
  profile,
  children,
}: {
  /**
   * The line under the brand. The only thing naming this console once the rail
   * is gone.
   *
   * Whose it is, not what kind — the account's own name, as every desktop rail
   * already shows. This said "Buying console" and "Transport console" while the
   * rail two pixels wider said "Kongu Foods", which is the same screen
   * disagreeing with itself about what it is looking at. A buyer knows they are
   * a buyer; what they cannot tell from a bar is which of their accounts they
   * are signed into.
   *
   * Operations are the exception and keep "Platform admin", because they are
   * not an account on the platform and have no name to show.
   */
  subtitle: string;
  groups: readonly MobileNavGroup[];
  /** The same badge counts the rail shows, keyed by href. */
  pending?: Record<string, number>;
  /** Chosen by the cookie, resolved on the server. See lib/i18n/console.ts. */
  locale: Locale;
  /** `t.brand.name`, in the reader's script. */
  brandName: string;
  /** Where the mark goes. This console's entry in `HOME_FOR_ROLE`. */
  homeHref: string;
  languageLabel: string;
  themeLabel: string;
  /** Which login is in use, for the bar's account menu. */
  session: { email?: string; role: Role };
  sessionLabels: { signedInAs: string; signOut: string; signingOut: string };
  /** This console's own account page, behind the person icon. */
  profile?: { href: string; label: string };
  /** Anything the console wants on the right — a bell, usually. */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    /*
      The bar lives inside <Sheet> rather than the other way round: the trigger
      has to be a descendant of the root for Radix to wire it to the content,
      and the root renders no element of its own, so nothing about the bar's
      layout changes by being nested here.
    */
    <Sheet open={open} onOpenChange={setOpen}>
      <ConsoleAppBar
        locale={locale}
        brandName={brandName}
        homeHref={homeHref}
        subtitle={subtitle}
        languageLabel={languageLabel}
        themeLabel={themeLabel}
        leading={
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
        }
      >
        {children}
      </ConsoleAppBar>

      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2.5">
            <span className="bg-white flex size-8 items-center justify-center rounded-full">
              <BrandLogo className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">{brandName}</span>
              <span className="text-faint text-xs font-normal">{subtitle}</span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {groups.map((group, at) => (
            <div key={group.label ?? at} className="flex flex-col gap-0.5">
              {/*
                A heading only where there is something to tell apart.

                A buyer has one group and it was labelled BUYING — a heading
                over the whole list naming what the list already is. It earns
                its place on a franchise, whose links come in two sets, and on
                admin, whose sixteen come in several.
              */}
              {group.label && groups.length > 1 ? (
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

        {/*
          Who is signed in, their own page, and the way out — at the foot of
          the drawer, which is where the rail has always kept them.

          These were briefly an account icon in the app bar. That put the way
          out of the application in the corner furthest from a thumb, and made a
          fourth icon compete with the business name for a 320px row. The drawer
          has the room and the rail already had the pattern.
        */}
        <div className="mt-auto shrink-0 border-t p-3">
          <SessionFooter
            email={session.email}
            role={session.role}
            labels={sessionLabels}
            profile={profile}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
