import {
  AlertTriangleIcon,
  BanIcon,
  ClockIcon,
  FileWarningIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { StatusBadge } from "@/components/admin/badges";
import { OverviewSnapshot } from "@/components/admin/overview-snapshot";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/franchise/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_LABELS,
  daysUntilExpiry,
  expiringDocuments,
  needsReview,
  worstExpiry,
  type ComplianceDocument,
} from "@/lib/domain/admin";
import {
  cropVolumes,
  freshnessSplit,
  stockValue,
} from "@/lib/domain/analytics";
import { relativeTime } from "@/lib/format";
import {
  buyerAccounts,
  driverAccounts,
  farmerAccounts,
  workers,
  vehicles,
} from "@/lib/mock/admin";
import { openListings } from "@/lib/mock/listings";
import { stockOffers } from "@/lib/mock/market";

export const metadata: Metadata = { title: "Overview · Admin" };

interface Lapse {
  subject: string;
  href: string;
  kind: string;
  document: ComplianceDocument;
  days: number;
}

export default async function AdminOverviewPage() {
  await connection();

  const now = new Date();
  const t = now.getTime();

  const buyers = buyerAccounts(now);
  const farmers = farmerAccounts(now);
  const drivers = driverAccounts(now);
  const fleet = vehicles(now);
  const crew = workers(now);
  const listings = openListings(now);
  const offers = stockOffers(now);

  const pendingBuyers = buyers.filter((b) => needsReview(b.status));
  const pendingFarmers = farmers.filter((f) => needsReview(f.status));
  const pendingDrivers = drivers.filter((d) => needsReview(d.status));
  const pendingVehicles = fleet.filter((v) => needsReview(v.status));
  const pendingCrew = crew.filter((m) => needsReview(m.status));

  const awaitingReview = [
    ...pendingBuyers.map((b) => ({
      id: b.id,
      name: b.name,
      kind: "Buyer",
      href: "/admin/buyers",
      at: b.registeredAt,
      status: b.status,
    })),
    ...pendingFarmers.map((f) => ({
      id: f.id,
      name: f.name,
      kind: "Farmer",
      href: "/admin/farmers",
      at: f.registeredAt,
      status: f.status,
    })),
    ...pendingDrivers.map((d) => ({
      id: d.id,
      name: d.name,
      kind: "Driver",
      href: "/admin/transport/drivers",
      at: d.registeredAt,
      status: d.status,
    })),
    ...pendingVehicles.map((v) => ({
      id: v.id,
      name: v.registration,
      kind: "Vehicle",
      href: "/admin/transport/vehicles",
      at: v.registeredAt,
      status: v.status,
    })),
    ...pendingCrew.map((m) => ({
      id: m.id,
      name: m.name,
      kind: "Crew",
      href: "/admin/transport/manpower",
      at: m.registeredAt,
      status: m.status,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Expiries across every entity that carries documents, worst first. This is
  // the list that stops a load going out uninsured.
  const lapses: Lapse[] = [
    ...drivers.flatMap((d) =>
      expiringDocuments(d.documents, t).map((doc) => ({
        subject: d.name,
        href: "/admin/transport/drivers",
        kind: "Driver",
        document: doc,
        days: daysUntilExpiry(doc, t) ?? 0,
      })),
    ),
    ...fleet.flatMap((v) =>
      expiringDocuments(v.documents, t).map((doc) => ({
        subject: v.registration,
        href: "/admin/transport/vehicles",
        kind: "Vehicle",
        document: doc,
        days: daysUntilExpiry(doc, t) ?? 0,
      })),
    ),
    ...crew.flatMap((m) =>
      expiringDocuments(m.documents, t).map((doc) => ({
        subject: m.name,
        href: "/admin/transport/manpower",
        kind: "Crew",
        document: doc,
        days: daysUntilExpiry(doc, t) ?? 0,
      })),
    ),
    ...buyers.flatMap((b) =>
      expiringDocuments(b.documents, t).map((doc) => ({
        subject: b.name,
        href: "/admin/buyers",
        kind: "Buyer",
        document: doc,
        days: daysUntilExpiry(doc, t) ?? 0,
      })),
    ),
  ].sort((a, b) => a.days - b.days);

  const expired = lapses.filter((l) => l.days < 0);

  // No credit is extended — every order is paid when it is placed — so the
  // fourth thing worth watching is accounts operations has stopped.
  const stopped = [
    ...buyers
      .filter((b) => b.status === "suspended" || b.status === "rejected")
      .map((b) => ({ id: b.id, name: b.name, kind: "Buyer", href: "/admin/buyers", status: b.status })),
    ...farmers
      .filter((f) => f.status === "suspended" || f.status === "rejected")
      .map((f) => ({ id: f.id, name: f.name, kind: "Farmer", href: "/admin/farmers", status: f.status })),
    ...drivers
      .filter((d) => d.status === "suspended" || d.status === "rejected")
      .map((d) => ({ id: d.id, name: d.name, kind: "Driver", href: "/admin/transport/drivers", status: d.status })),
  ];

  const groundedVehicles = fleet.filter(
    (v) => worstExpiry(v.documents, t) === "expired",
  );

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="What needs a decision today. Registrations waiting on review, documents lapsing, and accounts that have run past their credit."
      />

      <div className="grid grid-cols-2 gap-px border-b bg-border lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={awaitingReview.length}
          icon={ClockIcon}
          tone="warning"
          hint="Cannot transact until approved"
        />
        <StatTile
          label="Documents expired"
          value={expired.length}
          icon={AlertTriangleIcon}
          tone="danger"
          hint="Operating illegally right now"
        />
        <StatTile
          label="Expiring within 30 days"
          value={lapses.length - expired.length}
          icon={FileWarningIcon}
          tone="warning"
          hint="Renewals take weeks — chase now"
        />
        <StatTile
          label="Accounts stopped"
          value={stopped.length}
          icon={BanIcon}
          tone="danger"
          hint="Suspended or rejected"
        />
      </div>

      {groundedVehicles.length > 0 ? (
        <div className="border-destructive/40 bg-destructive-soft text-foreground mx-6 mt-6 flex items-start gap-3 rounded-lg border px-4 py-3">
          <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {groundedVehicles.length}{" "}
              {groundedVehicles.length === 1 ? "vehicle is" : "vehicles are"} off
              the road
            </span>
            <span className="text-muted-foreground text-sm">
              {groundedVehicles.map((v) => v.registration).join(", ")} — a lapsed
              certificate means any load carried is uninsured. Block dispatch
              before the next assignment.
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto shrink-0">
            <Link href="/admin/transport/vehicles">Review fleet</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-6 p-6 xl:grid-cols-2">
        <OverviewSnapshot
          stock={stockValue(offers)}
          freshness={freshnessSplit(offers, t)}
          crops={cropVolumes(offers, listings)}
        />

        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Awaiting review</h2>
            <span className="text-faint text-xs">Oldest first</span>
          </div>

          {awaitingReview.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Nothing waiting.
            </p>
          ) : (
            <ul className="divide-y">
              {awaitingReview.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    <span className="text-faint text-xs">
                      {item.kind} · {item.id} · submitted{" "}
                      {relativeTime(item.at, t)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={item.status} />
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.href}>Review</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Documents lapsing</h2>
            <span className="text-faint text-xs">Most urgent first</span>
          </div>

          {lapses.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Everything is in date.
            </p>
          ) : (
            <ul className="divide-y">
              {lapses.map((lapse) => (
                <li
                  key={`${lapse.subject}-${lapse.document.kind}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {lapse.subject}
                    </span>
                    <span className="text-faint text-xs">
                      {lapse.kind} · {DOCUMENT_LABELS[lapse.document.kind]} ·{" "}
                      {lapse.document.reference}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        lapse.days < 0
                          ? "border-destructive/40 bg-destructive-soft text-destructive tabular"
                          : "border-warning/40 bg-warning-soft text-warning tabular"
                      }
                    >
                      {lapse.days < 0
                        ? `Expired ${Math.abs(lapse.days)}d ago`
                        : `${lapse.days}d left`}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={lapse.href}>Open</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {stopped.length > 0 ? (
          <section className="bg-card flex flex-col rounded-lg border xl:col-span-2">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">Stopped accounts</h2>
            </div>
            <ul className="divide-y">
              {stopped.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {account.name}
                    </span>
                    <span className="text-faint text-xs">
                      {account.kind} · {account.id}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={account.status} />
                    <Button asChild variant="outline" size="sm">
                      <Link href={account.href}>Open</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
