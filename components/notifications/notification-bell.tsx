"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NotificationList } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Notification } from "@/lib/domain/notification";

/**
 * The bell, with the count that decides whether anybody looks at it.
 *
 * The number is capped rather than exact past a point: "50+" is the honest
 * reading of a list nobody has touched in weeks, and an exact count of a pile
 * that large is not a figure anybody acts on.
 *
 * Rendered from what the server already read for the page, so opening it costs
 * nothing and the count cannot disagree with the list behind it.
 */
export function NotificationBell({
  notifications,
  unread,
  capped,
  locale,
  href,
}: {
  notifications: Notification[];
  unread: number;
  /** The feed hit its limit, so `unread` is a floor rather than a total. */
  capped: boolean;
  locale: string;
  /** The full page, for when the dropdown is not enough. */
  href: string;
}) {
  const [open, setOpen] = useState(false);

  const label =
    unread === 0
      ? "Notifications"
      : `Notifications, ${unread}${capped ? " or more" : ""} unread`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="relative">
          <BellIcon className="size-4" />
          {unread > 0 ? (
            <span
              // Sits on the icon rather than beside it, so the rail's width
              // does not change when the first notification arrives.
              className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-medium tabular-nums"
              aria-hidden
            >
              {unread > 49 ? "50+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="flex max-h-[70svh] w-88 flex-col p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            See all
          </Link>
        </div>

        <NotificationList
          notifications={notifications}
          locale={locale}
          compact
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
