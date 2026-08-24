import type { ReactNode } from "react";

import { AccountBreadcrumbs } from "@/components/account/breadcrumbs";
import { getDictionary } from "@/lib/i18n";
import { consoleLocale } from "@/lib/i18n/console";

/**
 * The profile area for a farmer.
 *
 * The label comes from the dictionary, so the way back is written in the
 * language the rest of this console is being read in — it is the one word on
 * the trail a farmer has to recognise to know it takes them home.
 */
export default async function FarmAccountLayout({ children }: { children: ReactNode }) {
  const t = getDictionary(await consoleLocale());

  return (
    <>
      <AccountBreadcrumbs root="/farm/account" label={t.farm.nav.account} />
      {children}
    </>
  );
}
