import type { ReactNode } from "react";

import { requireConsole } from "@/lib/auth/require";

/**
 * Operations only, inside the admin console.
 *
 * A franchise reads most of the admin console but not Controls, Subscriptions,
 * the franchise roster or the KYC documents — and the way that is enforced is
 * that those pages live in this folder. No per-page check to forget, no list of
 * exceptions in a middleware to keep in step with the routes: a page is closed
 * because of where it sits.
 *
 * The group adds no markup. The shell, rail and top bar all come from the
 * `(admin)` layout above, which is what keeps a closed page looking like the
 * rest of the console rather than like a different application.
 *
 * The group is now a distinction without a difference: the `(admin)` shell
 * above admits operations alone, so a page either side of this boundary is
 * equally closed to everybody else. It is kept because the boundary is where
 * a second reader would go if one is ever admitted again, and collapsing it
 * would mean rediscovering which pages were sensitive.
 */
export default async function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Same door as the shell above, which already refused everybody who is not
  // operations. The path only matters for a session that has lapsed.
  await requireConsole(["admin"], "/admin/login");
  return children;
}
