import { HardHatIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/admin/badges";
import { Badge } from "@/components/ui/badge";
import { requireAgency } from "@/lib/auth/agency";
import {
  agencyDispatchable,
  needsReview,
  offers,
  worstExpiry,
} from "@/lib/domain/admin";
import { driverAccounts, vehicles, workers } from "@/lib/mock/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview · Agency" };

export default async function AgencyOverviewPage() {
  await connection();

  const { agency } = await requireAgency();
  const now = new Date();
  const t = now.getTime();

  const mine = <T extends { agencyId: string }>(rows: T[]) =>
    rows.filter((r) => r.agencyId === agency.id);

  const crew = mine(workers(now));
  const fleet = mine(vehicles(now));
  const drivers = mine(driverAccounts(now));

  const tiles = [
    {
      href: "/agency/workers",
      label: "Workers",
      icon: HardHatIcon,
      show: offers(agency, "manpower"),
      total: crew.length,
      waiting: crew.filter((w) => needsReview(w.status)).length,
    },
    {
      href: "/agency/fleet",
      label: "Vehicles",
      icon: TruckIcon,
      show: offers(agency, "transport"),
      total: fleet.length,
      waiting: fleet.filter((v) => needsReview(v.status)).length,
    },
    {
      href: "/agency/drivers",
      label: "Drivers",
      icon: ShieldCheckIcon,
      show: offers(agency, "transport"),
      total: drivers.length,
      waiting: drivers.filter((d) => needsReview(d.status)).length,
    },
  ].filter((tile) => tile.show);

  const grounded = !agencyDispatchable(agency, t);

  return (
    <>
      <PageHeader
        title={agency.name}
        description="Everything you register here is reviewed by operations before it can be sent on a job. Add your people and your vehicles; we verify them."
        aside={<StatusBadge status={agency.status} />}
      />

      <div className="flex flex-col gap-6 p-6">
        {/* The agency's own compliance gates everything under it, so it is
            stated before the counts rather than buried in the profile page. */}
        {grounded ? (
          <div className="border-destructive/40 bg-destructive-soft text-destructive rounded-lg border p-4 text-sm">
            <span className="font-medium">Nothing can be dispatched.</span>{" "}
            {worstExpiry(agency.documents, t) === "expired"
              ? "One of the agency's own documents has expired. Renew it and send the new certificate to operations — your workers and vehicles are grounded until then, and none of them is the problem."
              : "This agency is not verified. Operations will be in touch."}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ href, label, icon: Icon, total, waiting }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "bg-card hover:border-primary/40 focus-visible:ring-ring flex flex-col gap-3 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                <Icon className="size-4" />
                {label}
              </span>
              <span className="tabular text-3xl font-semibold">{total}</span>
              {waiting > 0 ? (
                <Badge
                  variant="outline"
                  className="border-warning/40 bg-warning-soft text-warning w-fit"
                >
                  {waiting} awaiting review
                </Badge>
              ) : (
                <span className="text-faint text-xs">All reviewed</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
