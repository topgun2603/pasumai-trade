import type { ReactNode } from "react";

import { ConsoleNav } from "@/components/franchise/console-nav";
import { CURRENT_FRANCHISE } from "@/lib/mock/listings";

/**
 * The franchise console shell.
 *
 * A persistent left rail rather than a top bar: this surface is operated all
 * day at a desk, and the operator moves between listings, orders and dispatch
 * constantly. The farmer surface makes the opposite call — two destinations,
 * no rail — because it is used a few times a week.
 */
export default function FranchiseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <ConsoleNav franchise={CURRENT_FRANCHISE} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
