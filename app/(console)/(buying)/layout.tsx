import type { ReactNode } from "react";

import { ConsoleNav } from "@/components/franchise/console-nav";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";

/**
 * The buying console shell.
 *
 * A persistent left rail rather than a top bar: this surface is operated all
 * day at a desk, and the operator moves between listings, orders and dispatch
 * constantly. The farmer surface makes the opposite call — two destinations,
 * no rail — because it is used a few times a week.
 */
export default async function BuyingLayout({
  children,
}: {
  children: ReactNode;
}) {
  /*
    Both buying roles, because a franchise buys produce exactly as an
    independent buyer does — the market, bargains and orders are genuinely the
    same screens. What is *not* shared moved to `(franchise)`, which guards on
    `franchise` alone: dispatch and grower records used to sit in this layout
    behind nothing but `BUYING_ROLES`, so any buyer could open them.

    Operations too: they need to see what a buyer sees when a buyer calls to
    ask why something is missing.
  */
  const session = await requireConsole([...BUYING_ROLES, "admin"]);

  // The rail is on every screen, so the unread count belongs here rather than
  // on the notifications page — a count only visible once you have arrived is
  // a count nobody sees.
  const feed = await readNotifications(session.claims.accountId ?? "");

  return (
    <div className="flex min-h-svh w-full">
      <ConsoleNav
        session={{ email: session.email, role: session.claims.role }}
        pending={{ "/notifications": feed.unread }}
        notifications={{
          rows: feed.notifications,
          unread: feed.unread,
          capped: isCapped(feed),
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
