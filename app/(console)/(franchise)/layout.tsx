import type { ReactNode } from "react";

import { ConsoleNav } from "@/components/franchise/console-nav";
import { requireConsole } from "@/lib/auth/require";
import { CURRENT_FRANCHISE } from "@/lib/mock/listings";

/**
 * The franchise console shell.
 *
 * A persistent left rail rather than a top bar: this surface is operated all
 * day at a desk, and the operator moves between listings, orders and dispatch
 * constantly. The farmer surface makes the opposite call — two destinations,
 * no rail — because it is used a few times a week.
 */
export default async function FranchiseLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Operations too: they need to see what a buyer sees when a buyer calls to
  // ask why something is missing.
  const session = await requireConsole(["buyer", "admin"]);

  return (
    <div className="flex min-h-svh w-full">
      <ConsoleNav
        franchise={CURRENT_FRANCHISE}
        session={{ email: session.email, role: session.claims.role }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
