"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The way back out of a profile sub-page.
 *
 * Verification, Subscription, Bank details and History are all reached from
 * the profile hub and, until now, led nowhere. The rail highlights My Profile
 * while you are on them, so the one control that looks like it should return
 * you is the one that appears to do nothing — leaving the browser's back
 * button, which on an installed PWA is not on screen at all.
 *
 * ## Why it lives in a layout
 *
 * Rendered once per console from `account/layout.tsx` rather than added to ten
 * pages, so a sub-page written next month has a way back the moment it exists.
 * That means it also wraps the hub itself, which is why it renders nothing
 * when there is nowhere to go — a breadcrumb pointing at the page you are
 * already on is furniture.
 */

/**
 * What each sub-page is called, matching its own heading.
 *
 * A slug title-cased gives "Bank" and "History"; the pages call themselves
 * "Bank details" and "History". The trail has to agree with the heading it
 * sits above, or it reads as a different page.
 */
const SEGMENTS: Record<string, string> = {
  verification: "Verification",
  subscription: "Subscription",
  bank: "Bank details",
  history: "History",
};

export function AccountBreadcrumbs({
  root,
  label,
}: {
  /** The profile hub for this console — `/farm/account`, `/account`, … */
  root: string;
  /** What that hub is called here. Translated on the farm console. */
  label: string;
}) {
  const pathname = usePathname();

  // At the hub, or somewhere this does not describe. Nothing to say.
  if (!pathname.startsWith(`${root}/`)) return null;

  const segment = pathname.slice(root.length + 1).split("/")[0];
  const here = SEGMENTS[segment];

  /*
    An unmapped segment gets a trail with no leaf rather than a guessed one.
    The link back is the part that matters and it still works; inventing a
    name from a slug is how a page ends up labelled "Kyc".
  */
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground border-b px-6 py-2.5 text-sm"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href={root}
            className="hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {label}
          </Link>
        </li>
        {here ? (
          <>
            <li aria-hidden className="flex items-center">
              <ChevronRightIcon className="size-3.5" />
            </li>
            {/* The page you are on, named but not a link. */}
            <li className="text-foreground font-medium" aria-current="page">
              {here}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
