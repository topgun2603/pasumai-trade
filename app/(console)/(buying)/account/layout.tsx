import type { ReactNode } from "react";

import { AccountBreadcrumbs } from "@/components/account/breadcrumbs";

/**
 * The profile area for a buying account.
 *
 * Exists only to hang the breadcrumb above every page under it, including the
 * ones nobody has written yet — see `components/account/breadcrumbs.tsx`. The
 * hub itself renders no trail, because there is nowhere for it to point.
 */
export default function BuyingAccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AccountBreadcrumbs root="/account" label="My Profile" />
      {children}
    </>
  );
}
