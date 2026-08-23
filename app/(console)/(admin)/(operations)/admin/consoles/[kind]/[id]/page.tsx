import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  BellIcon,
  HandshakeIcon,
  HardHatIcon,
  PackageIcon,
  PhoneIcon,
  SproutIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AdminPageHeader } from "@/components/admin/page-header";
import { CONSOLE_LOOK } from "@/components/console/console-look";
import { StatTile } from "@/components/franchise/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireConsole } from "@/lib/auth/require";
import { CONSOLES, isConsoleKind } from "@/lib/domain/console-kinds";
import { CHECK_LABELS, kycState, KYC_LABELS } from "@/lib/domain/kyc";
import { describePlan } from "@/lib/domain/subscription";
import { readDossier } from "@/lib/firebase/dossier-read";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} · Admin` };
}

/**
 * Everything the platform knows about one account.
 *
 * Deliberately a dossier rather than the client's own console. Every console
 * reads `session.claims.accountId`, which an admin does not have — making one
 * render somebody else's data would mean either threading a borrowed identity
 * through every page, or minting a session as them. The second is
 * impersonation: an operator who can act *as* a farmer can accept a price on
 * their behalf and leave no record that it was not them, on a platform whose
 * whole argument is that the two sides settle it between themselves.
 *
 * So: read-only, one page, assembled from the same collections the client's own
 * screens read. For the question an operator actually has on a telephone call —
 * what is going on with this account — one page beats six.
 */
export default async function AccountDossierPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  // Checked before the reads, so an unknown console kind costs no round trips.
  // Note the status caveat on the directory page: under this layout a
  // `notFound()` still returns 200, because the shell has already streamed.
  const { kind, id } = await params;
  if (!isConsoleKind(kind)) notFound();

  await connection();
  await requireConsole(["admin"]);

  const definition = CONSOLES[kind];
  const look = CONSOLE_LOOK[kind];
  const dossier = await readDossier(kind, id);
  if (!dossier) notFound();

  const { account, checks, activity, recent } = dossier;
  const verification = kycState(checks, definition.role);
  const plan = account.plan ? describePlan(account.plan) : null;

  // Only the counters that mean anything for this kind of account. A farmer has
  // no fleet, and a lorry firm lists no produce — showing both as zero would
  // make every dossier look half empty.
  const supplies = kind === "farmers";
  const buys = kind === "buyers" || kind === "franchises";
  const staffs = kind === "transport" || kind === "manpower";

  return (
    <>
      <AdminPageHeader
        icon={
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${look.disc}`}
          >
            <look.icon className="size-5" />
          </span>
        }
        title={account.name}
        description={`${definition.one} · ${account.id}${account.place ? ` · ${account.place}` : ""}${account.district ? `, ${account.district}` : ""}`}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {account.mobile ? (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:+91${account.mobile}`}>
                  <PhoneIcon className="size-3.5" />
                  {account.mobile}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/consoles/${kind}`}>
                <ArrowLeftIcon className="size-3.5" />
                All {definition.label.toLowerCase()}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Verification"
          value={checks.filter((check) => check.state === "verified").length}
          icon={BadgeCheckIcon}
          tone={verification === "verified" ? "success" : "warning"}
          hint={KYC_LABELS[verification]}
        />
        <StatTile
          label="Plan"
          value={plan ? 1 : 0}
          icon={BanknoteIcon}
          tone={account.planStatus === "active" ? "success" : "warning"}
          hint={plan ? `${plan.title} · ${account.planStatus}` : "No subscription"}
        />
        {supplies ? (
          <StatTile
            label="Listings"
            value={activity.listings}
            icon={SproutIcon}
            tone="info"
            hint={`${activity.openListings} still open`}
          />
        ) : staffs ? (
          <StatTile
            label="Fleet and crew"
            value={activity.vehicles + activity.drivers + activity.workers}
            icon={kind === "transport" ? TruckIcon : HardHatIcon}
            tone="info"
            hint={
              kind === "transport"
                ? `${activity.vehicles} vehicles · ${activity.drivers} drivers`
                : `${activity.workers} workers`
            }
          />
        ) : (
          <StatTile
            label="Orders"
            value={activity.orders}
            icon={PackageIcon}
            tone="info"
            hint="Placed on the platform"
          />
        )}
        <StatTile
          label="Bargains"
          value={activity.bargains}
          icon={HandshakeIcon}
          tone="success"
          hint={`${activity.agreedBargains} agreed`}
        />
      </div>

      <div className="grid grid-cols-1 content-start gap-6 p-6 xl:grid-cols-2">
        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Verification</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/kyc">Open the queue</Link>
            </Button>
          </div>

          {checks.length === 0 ? (
            <EmptyState
              icon={BadgeCheckIcon}
              tone="waiting"
              title="Nothing submitted yet"
              description="This account has uploaded no documents. Until it does, it cannot trade."
              className="m-4 border-0 py-8"
            />
          ) : (
            <ul className="divide-y">
              {checks.map((check) => (
                <li
                  key={check.kind}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{CHECK_LABELS[check.kind]}</span>
                    {check.reference ? (
                      <span className="text-muted-foreground font-mono text-xs">
                        {check.reference}
                      </span>
                    ) : null}
                    {check.reason ? (
                      <span className="text-warning text-xs">{check.reason}</span>
                    ) : null}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      check.state === "verified"
                        ? "border-success/40 text-success"
                        : check.state === "failed"
                          ? "border-destructive/40 text-destructive"
                          : "border-warning/40 bg-warning-soft text-warning"
                    }
                  >
                    {check.state}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">What has happened</h2>
            <span className="text-faint text-xs">Newest first</span>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              icon={BellIcon}
              tone="waiting"
              title="No activity yet"
              description="Listings, bargains, orders and vehicle requests appear here as they happen."
              className="m-4 border-0 py-8"
            />
          ) : (
            <ul className="divide-y">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{row.what}</span>
                    <span className="text-faint truncate text-xs">{row.detail}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                    {row.at ? row.at.toISOString().slice(0, 10) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card flex flex-col rounded-lg border xl:col-span-2">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Everything on the account</h2>
          </div>
          {/*
            Tiles that wrap rather than cells in a fixed grid. The grid was six
            columns wide for a list that is only ever three, four or five long
            depending on the kind of account, so every dossier ended with a
            stretch of empty ruled cells — which reads as data that failed to
            load rather than a counter that does not apply here.
          */}
          <dl className="flex flex-wrap gap-3 p-4">
            {[
              { label: "Listings", value: activity.listings, icon: SproutIcon, show: supplies },
              { label: "Bargains", value: activity.bargains, icon: HandshakeIcon, show: true },
              { label: "Orders", value: activity.orders, icon: PackageIcon, show: buys },
              {
                label: "Vehicle requests",
                value: activity.pickups,
                icon: TruckIcon,
                show: supplies,
              },
              { label: "Vehicles", value: activity.vehicles, icon: TruckIcon, show: staffs },
              { label: "Drivers", value: activity.drivers, icon: UsersIcon, show: staffs },
              { label: "Workers", value: activity.workers, icon: HardHatIcon, show: staffs },
              {
                label: "Notifications",
                value: activity.notifications,
                icon: BellIcon,
                show: true,
              },
            ]
              .filter((entry) => entry.show)
              .map((entry) => (
                <div
                  key={entry.label}
                  className="flex min-w-36 flex-1 flex-col gap-1 rounded-lg border px-3 py-2.5"
                >
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <entry.icon className="size-3.5 shrink-0" />
                    {entry.label}
                  </dt>
                  <dd
                    className={`tabular text-xl font-semibold ${entry.value === 0 ? "text-faint" : ""}`}
                  >
                    {entry.value}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      </div>
    </>
  );
}
