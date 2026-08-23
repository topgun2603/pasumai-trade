/**
 * Which of the admin console a franchise may read.
 *
 * A franchise is a regional partner, not staff — but the thing they asked for
 * is the operations console minus the ability to change anything. So the same
 * pages, the same rail, and every button that writes taken away.
 *
 * ## An allow-list, not a deny-list
 *
 * The obvious build names the four sections a franchise may *not* see. It is
 * wrong for one reason: the next page added to `(admin)` would be visible to
 * every franchise on the platform the moment it existed, and nobody would
 * notice. Listing what is open instead means a new page is closed until
 * somebody says otherwise, which is the only default worth having when the
 * cost of being wrong is a partner reading records that are not theirs.
 *
 * `admin-access.test.ts` walks the route tree and fails if a page is in
 * neither list, so "somebody says otherwise" is a decision CI insists on
 * rather than one that can be skipped.
 *
 * ## Where this is actually enforced
 *
 * Not here. This is a predicate; the gates are:
 *
 *  - `(admin)/layout.tsx` admits `admin` and `franchise` to the shell.
 *  - `(admin)/(operations)/layout.tsx` admits `admin` alone, and every closed
 *    page lives under it. The route group *is* the enforcement — a page in
 *    that folder is guarded by existing there.
 *  - Every write endpoint already calls `requireRole("admin")`, which is what
 *    makes "read only" true rather than merely unrendered. Hiding a button
 *    from a partner who can open developer tools is not a permission.
 *
 * This list is what the rail renders from, so the nav and the gate cannot
 * drift into disagreeing about what a franchise can reach.
 */

/**
 * Admin paths open to a franchise, read-only.
 *
 * `/admin` matches exactly — as a prefix it would match the whole console.
 * Everything else matches itself and anything beneath it, so the four
 * transport pages come in under one entry.
 */
export const FRANCHISE_ADMIN_PATHS = [
  "/admin",
  "/admin/notifications",
  "/admin/analytics",
  "/admin/chat",
  "/admin/buyers",
  "/admin/farmers",
  "/admin/transport",
  "/admin/listings",
] as const;

export function franchiseMayRead(pathname: string): boolean {
  // Exact, and handled before the loop so the entry cannot act as a prefix.
  if (pathname === "/admin") return true;

  return FRANCHISE_ADMIN_PATHS.some(
    (allowed) =>
      allowed !== "/admin" &&
      (pathname === allowed || pathname.startsWith(`${allowed}/`)),
  );
}
