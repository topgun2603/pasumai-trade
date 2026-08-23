import { HandshakeIcon, PackageIcon, StoreIcon } from "lucide-react";
import type { Metadata } from "next";

import { WelcomeHome } from "@/components/console/welcome-home";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";

export const metadata: Metadata = { title: "Home" };

export default async function BuyingHomePage() {
  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const franchise = session.claims.role === "franchise";

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
      continueTo="/overview"
    />
  );
}
