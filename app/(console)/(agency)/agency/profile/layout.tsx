import type { ReactNode } from "react";

import { AccountBreadcrumbs } from "@/components/account/breadcrumbs";

/** The profile area for an agency. See the buying one for why this exists. */
export default function AgencyProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AccountBreadcrumbs root="/agency/profile" label="My Profile" />
      {children}
    </>
  );
}
