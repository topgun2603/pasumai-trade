import { HardHatIcon, TruckIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdSlot } from "@/components/ads/ad-slot";
import { WelcomeHome } from "@/components/console/welcome-home";
import { AGENCY_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { readPlacements } from "@/lib/firebase/ads-read";
import { consoleLocale } from "@/lib/i18n/console";

export const metadata: Metadata = { title: "Home" };

export default async function AgencyHomePage() {
  await connection();

  // Hoisted out of the render expression, and passed to the reader rather
  // than read inside it — see lib/domain/ad.ts.
  const now = new Date().getTime();

  const [session, locale] = await Promise.all([
    requireConsole([...AGENCY_ROLES, "admin"]),
    consoleLocale(),
  ]);
  const manpower = session.claims.role === "manpower";

  const placed = await readPlacements({
    at: now,
    surface: "agency",
    locale,
    role: session.claims.role,
  });

  return (
    <WelcomeHome
      greeting="Welcome to Pasumai Trade"
      blurb={
        manpower
          ? "Supply crews to the farms and yards that need them, with the rate agreed on the record before anybody travels."
          : "Move produce from the farm gate to the buyer, with the run and the rate agreed before the lorry leaves."
      }
      highlights={
        manpower
          ? [
              {
                icon: HardHatIcon,
                title: "Your crew",
                body: "Everyone you can send, their skills and whether their papers are checked.",
              },
              {
                icon: UsersIcon,
                title: "Book Orders",
                body: "Work waiting to be taken, and what has already been assigned to you.",
              },
              {
                icon: TruckIcon,
                title: "Verified once",
                body: "Documents are checked once and stand until they expire.",
              },
            ]
          : [
              {
                icon: TruckIcon,
                title: "Book Transport",
                body: "Runs waiting for a vehicle, with the district and distance up front.",
              },
              {
                icon: UsersIcon,
                title: "Transport and drivers",
                body: "Your vehicles and the people who drive them, in one roster.",
              },
              {
                icon: HardHatIcon,
                title: "Verified once",
                body: "Documents are checked once and stand until they expire.",
              },
            ]
      }
      sponsored={<AdSlot slotId="agency.home" placed={placed} />}
      continueTo="/agency"
    />
  );
}
