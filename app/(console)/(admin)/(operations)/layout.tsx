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
 * There is nothing stopping somebody adding a page in the wrong folder, so
 * `lib/auth/admin-access.test.ts` walks the tree and fails if a route is
 * neither here nor in the franchise allow-list.
 */
export default async function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Same door as the shell above. A franchise who reaches one of these pages
  // is signed in and simply not allowed, so they are sent to their own console
  // by `requireConsole`; the path only matters for a session that has lapsed.
  await requireConsole(["admin"], "/admin/login");
  return children;
}
