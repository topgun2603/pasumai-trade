import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  ClockIcon,
  FileWarningIcon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { StatusBadge } from "@/components/admin/badges";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/franchise/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DOCUMENT_LABELS,
  daysUntilExpiry,
  expiringDocuments,
  needsReview,
  worstExpiry,
  type ComplianceDocument,
} from "@/lib/domain/admin";
import { CHECK_LABELS } from "@/lib/domain/kyc";
import { relativeTime } from "@/lib/format";
import { readCompliance, readWaitingPickups } from "@/lib/firebase/compliance-read";
import { readKycAccounts } from "@/lib/firebase/kyc-read";

export const metadata: Metadata = { title: "Overview · Admin" };

interface Lapse {
  subject: string;
  href: string;
  kind: string;
  document: ComplianceDocument;
  days: number;
}

/**
 * What needs a decision today.
 *
 * This page used to be built entirely from `lib/mock/admin` — five fixtures
 * with invented expiry dates — while the real `vehicles`, `drivers` and
 * `workers` collections sat in Firestore unread. The banner warning that a
 * vehicle was off the road was warning about a lorry nobody owns, and a
 * genuinely lapsed insurance certificate would not have shown up anywhere at
 * all. That is the worst way for a compliance screen to be wrong: reassuring.
 *
 * Everything here is now counted from records somebody wrote. The old "run past
 * their credit" framing is gone with it — no credit is extended on this
 * platform, every order is paid when placed, and the header said otherwise.
 */
export default async function AdminOverviewPage() {
  await connection();

  const now = new Date();
  const t = now.getTime();

  const [{ subjects, live }, pickups, kycAccounts] = await Promise.all([
    readCompliance(),
    readWaitingPickups(),
    readKycAccounts(),
  ]);

  /*
    Everything waiting on a person here, from the two places work actually
    arrives: somebody who asked to be called, and a document somebody uploaded.
    The old version listed accounts with a `pending` status, which is a state
    the mock set and nothing on the live platform ever writes.
  */
  const awaitingReview = [
    ...kycAccounts.flatMap((account) =>
      account.checks
        .filter((check) => check.state === "review")
        .map((check) => ({
          id: `kyc-${account.accountId}-${check.kind}`,
          name: account.name,
          kind: CHECK_LABELS[check.kind],
          href: "/admin/kyc",
          at: check.checkedAt ?? now,
          status: "pending",
        })),
    ),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // Expiries across everything that carries documents, worst first. This is the
  // list that stops a load going out uninsured.
  const lapses: Lapse[] = subjects
    .flatMap((subject) =>
      expiringDocuments(subject.documents, t).map((document) => ({
        subject: subject.name,
        href: subject.href,
        kind: subject.kind,
        document,
        days: daysUntilExpiry(document, t) ?? 0,
      })),
    )
    .sort((a, b) => a.days - b.days);

  const expired = lapses.filter((lapse) => lapse.days < 0);

  const stopped = subjects.filter(
    (subject) => subject.status === "suspended" || subject.status === "rejected",
  );

  const unverified = subjects.filter((subject) => needsReview(subject.status));

  const grounded = subjects.filter(
    (subject) => subject.kind === "Vehicle" && worstExpiry(subject.documents, t) === "expired",
  );

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="What needs a decision today. Documents waiting on a person, certificates lapsing, and produce with no vehicle coming for it."
      />

      {live ? null : (
        <p className="border-warning/40 bg-warning-soft text-warning border-b px-6 py-3 text-sm">
          Nothing could be read from the database, so every figure below is zero. That is a
          failure to read, not a quiet platform.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 border-b p-4 lg:grid-cols-4">
        <StatTile
          label="Waiting on us"
          value={awaitingReview.length}
          icon={ClockIcon}
          tone="warning"
          hint="Documents waiting to be checked"
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
          label="Produce with no vehicle"
          value={pickups.length}
          icon={TruckIcon}
          tone="danger"
          hint="Cut and waiting at the farm"
        />
      </div>

      {grounded.length > 0 ? (
        <div className="border-destructive/40 bg-destructive-soft text-foreground mx-6 mt-6 flex items-start gap-3 rounded-lg border px-4 py-3">
          <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {grounded.length} {grounded.length === 1 ? "vehicle is" : "vehicles are"} off the
              road
            </span>
            <span className="text-muted-foreground text-sm">
              {grounded.map((vehicle) => vehicle.name).join(", ")} — a lapsed certificate means
              any load carried is uninsured. Block dispatch before the next assignment.
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="ml-auto shrink-0">
            <Link href="/admin/transport/vehicles">Review fleet</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-6 p-6 xl:grid-cols-2">
        {/*
          First panel, because it is the only thing here with produce spoiling
          behind it. Everything else on this page can wait until tomorrow.
        */}
        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Produce with no vehicle</h2>
            <span className="text-faint text-xs">Longest wait first</span>
          </div>

          {pickups.length === 0 ? (
            <EmptyState
              icon={TruckIcon}
              tone="done"
              title="Every load has a vehicle"
              description="No produce is cut and waiting. A farmer's request appears here the moment nobody has accepted it."
              className="m-4 border-0"
            />
          ) : (
            <ul className="divide-y">
              {pickups.map((pickup) => (
                <li key={pickup.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">
                      {pickup.produceName} · {pickup.quantity} {pickup.unit}
                    </span>
                    <span className="text-faint text-xs">
                      {pickup.farmerName} · {pickup.district} · asked{" "}
                      {relativeTime(pickup.requestedAt, t)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {pickup.expiresAt.getTime() < t ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive-soft text-destructive"
                      >
                        Nobody took it
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning/40 text-warning">
                        Still looking
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Waiting on us</h2>
            <span className="text-faint text-xs">Oldest first</span>
          </div>

          {awaitingReview.length === 0 ? (
            <EmptyState
              icon={BadgeCheckIcon}
              tone="done"
              title="Nothing waiting on us"
              description="Every enquiry has been called and every uploaded document decided."
              className="m-4 border-0"
            />
          ) : (
            <ul className="divide-y">
              {awaitingReview.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    <span className="text-faint text-xs">
                      {item.kind} · asked {relativeTime(item.at, t)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.href}>Open</Link>
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
            <EmptyState
              icon={ShieldCheckIcon}
              tone="done"
              title="Everything is in date"
              description="No licence, insurance, fitness certificate or permit lapses within thirty days. They appear here well before they expire, because a renewal in India takes weeks."
              className="m-4 border-0"
            />
          ) : (
            <ul className="divide-y">
              {lapses.map((lapse) => (
                <li
                  key={`${lapse.subject}-${lapse.document.kind}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{lapse.subject}</span>
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

        <section className="bg-card flex flex-col rounded-lg border">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <h2 className="font-medium">Not cleared to work</h2>
            <span className="text-faint text-xs">Stopped or unverified</span>
          </div>

          {stopped.length + unverified.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              tone="done"
              title="Everybody is cleared to work"
              description="No account is suspended, refused or still waiting on verification. Anyone stopped by operations shows up here so a dispatch is never planned around them."
              className="m-4 border-0"
            />
          ) : (
            <ul className="divide-y">
              {[...stopped, ...unverified].map((subject) => (
                <li
                  key={`${subject.kind}-${subject.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{subject.name}</span>
                    <span className="text-faint text-xs">
                      {subject.kind} · {subject.id}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={subject.status} />
                    <Button asChild variant="outline" size="sm">
                      <Link href={subject.href}>Open</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
