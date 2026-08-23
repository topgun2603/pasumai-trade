import { HandshakeIcon, SproutIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { WelcomeHome } from "@/components/console/welcome-home";
import { requireFarmer } from "@/lib/auth/farm";
import { consoleLocale } from "@/lib/i18n/console";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = { title: "Home · Farmer" };

/**
 * The farmer's welcome page.
 *
 * In their own language, like the rest of this console — a welcome nobody can
 * read is worse than no welcome at all. The copy is written for somebody who
 * may be opening the app for the first time, standing in a field, having been
 * shown it by a field officer ten minutes ago.
 */
export default async function FarmHomePage() {
  await connection();

  const [{ farmer }, locale] = await Promise.all([requireFarmer(), consoleLocale()]);
  const t = getDictionary(locale);

  return (
    <WelcomeHome
      greeting={t.farm.home.greeting}
      name={farmer.name || undefined}
      blurb={t.farm.home.blurb}
      highlights={[
        { icon: SproutIcon, title: t.farm.nav.produce, body: t.farm.home.produce },
        { icon: HandshakeIcon, title: t.farm.nav.bargains, body: t.farm.home.bargains },
        { icon: TruckIcon, title: t.farm.nav.logistics, body: t.farm.home.logistics },
      ]}
      continueTo="/farm"
      continueLabel={t.farm.home.continueLabel}
    />
  );
}
