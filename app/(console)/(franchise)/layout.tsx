import type { ReactNode } from "react";

import { ConsoleNav } from "@/components/franchise/console-nav";
import { ConsoleTopBar } from "@/components/console/top-bar";
import { requireConsole } from "@/lib/auth/require";
import { isCapped, readNotifications } from "@/lib/firebase/notifications-read";

/**
 * The franchise console.
 *
 * Split from the buying console it used to share. A franchise and a buyer were
 * treated as one thing — `BUYING_ROLES` guarded a single layout, and Dispatch
 * and Farmers sat inside it with no further check. So any buyer could open
 * `/dispatch` and see loads being assigned, and `/farmers` and read growers'
 * records, neither of which is theirs to see.
 *
 * What is genuinely shared stays shared: a franchise buys produce, so the
 * market, bargains and orders are the same screens under `(buying)`. What is
 * not shared lives here, behind `franchise` alone.
 *
 * Nested under `/franchise` rather than at the root, so the two consoles can
 * never collide on a path and it is obvious from a URL in a support ticket
 * which one somebody was looking at.
 */
export default async function FranchiseLayout({ children }: { children: ReactNode }) {
  // Operations too: they field the call when a franchise cannot work a screen.
  const session = await requireConsole(["franchise", "admin"]);

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
      <div className="flex min-w-0 flex-1 flex-col">
        <ConsoleTopBar session={{ email: session.email, role: session.claims.role }} />
        {children}
      </div>
    </div>
  );
}
