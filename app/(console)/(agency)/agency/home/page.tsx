import { HardHatIcon, TruckIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { WelcomeHome } from "@/components/console/welcome-home";
import { AGENCY_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";

export const metadata: Metadata = { title: "Home" };

export default async function AgencyHomePage() {
  const session = await requireConsole([...AGENCY_ROLES, "admin"]);
  const manpower = session.claims.role === "manpower";

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
      continueTo="/agency"
    />
  );
}
