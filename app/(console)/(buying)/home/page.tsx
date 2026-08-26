import { HandshakeIcon, PackageIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdSlot } from "@/components/ads/ad-slot";
import { WelcomeHome } from "@/components/console/welcome-home";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { readPlacements } from "@/lib/firebase/ads-read";
import { consoleLocale } from "@/lib/i18n/console";

export const metadata: Metadata = { title: "Home" };

export default async function BuyingHomePage() {
  await connection();

  // Hoisted out of the render expression, and passed to the reader rather
  // than read inside it — see lib/domain/ad.ts.
  const now = new Date().getTime();

  const [session, locale] = await Promise.all([
    requireConsole([...BUYING_ROLES, "admin"]),
    consoleLocale(),
  ]);
  const franchise = session.claims.role === "franchise";

  const placed = await readPlacements({
    at: now,
    surface: "buying",
    locale,
    role: session.claims.role,
  });

  return (
    <WelcomeHome
      greeting="Welcome to Pasumai Trade"
      blurb={
        franchise
          ? "Buy direct from growers across India, and run the collection for your district."
          : "Buy produce direct from the people who grew it, at a price the two of you agree between yourselves."
      }
      highlights={[
        {
          icon: StoreIcon,
          title: "Marketplace",
          body: "Everything listed today, by crop, grade and district. Browsing is free.",
        },
        {
          icon: HandshakeIcon,
          title: "Bargains",
          body: "Agree a rate grade by grade. Whatever you settle on is what gets weighed.",
        },
        {
          icon: PackageIcon,
          title: "Orders",
          body: "Once a price is agreed, the collection and the lorry are ours to arrange.",
        },
      ]}
      sponsored={<AdSlot slotId="buying.home" placed={placed} />}
      continueTo="/overview"
    />
  );
}
