"use client";

import { CircleSlashIcon } from "lucide-react";

import {
  ComplianceBadge,
  DocumentList,
  StatusBadge,
} from "@/components/admin/badges";
import { EntityPhoto } from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import { Badge } from "@/components/ui/badge";
import {
  ENGAGEMENT_LABELS,
  MANPOWER_SKILL_LABELS,
  workerDispatchable,
  type Worker,
} from "@/lib/domain/admin";
import { formatMoney, money } from "@/lib/domain/money";
import { relativeTime } from "@/lib/format";

/**
 * Registered crew.
 *
 * The column that matters most is not verification — it is whether this person
 * can be put on a job today, which four separate things can prevent: not yet
 * verified, suspended, a lapsed document, or simply off the roster. The console
 * has to tell them apart, because only two of the four are anyone's problem to
 * fix.
 */
export function ManpowerTable({
  crew,
  now,
  agencyNames,
  readOnly = false,
}: {
  crew: Worker[];
  now: number;
  /** Agency id to name. Omitted by an agency's own console, where every
   *  row belongs to them and the column would say the same thing throughout. */
  agencyNames?: Record<string, string>;
  /** Hides every row action. A franchise reads these screens, nothing more. */
  readOnly?: boolean;
}) {
  const columns: Column<Worker>[] = [
    {
      key: "name",
      header: "Name",
      className: "min-w-48",
      sortValue: (m) => m.name,
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={m.name}
            seed={m.id}
            photoUrl={m.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{m.name}</span>
            <span className="text-faint truncate text-xs">
              {m.id} · {m.mobile}
            </span>
          </span>
        </div>
      ),
    },
    ...(agencyNames
      ? [
          {
            key: "agency",
            header: "Agency",
            className: "min-w-40",
            sortValue: (r: { agencyId: string }) =>
              agencyNames[r.agencyId] ?? r.agencyId,
            cell: (r: { agencyId: string }) => (
              <span className="flex flex-col leading-tight">
                <span className="truncate text-sm">
                  {agencyNames[r.agencyId] ?? "Unknown agency"}
                </span>
                <span className="text-faint font-mono text-xs">
                  {r.agencyId}
                </span>
              </span>
            ),
          },
        ]
      : []),
    {
      key: "based",
      header: "Based",
      className: "min-w-36",
      sortValue: (m) => m.district,
      cell: (m) => (
        <span className="flex flex-col leading-tight">
          <span>{m.place}</span>
          <span className="text-faint text-xs">{m.district}</span>
        </span>
      ),
    },
    {
      key: "skills",
      header: "Skills",
      className: "min-w-44",
      sortValue: (m) => m.skills.length,
      cell: (m) => (
        <span className="flex flex-wrap gap-1">
          {m.skills.map((s) => (
            <Badge key={s} variant="secondary">
              {MANPOWER_SKILL_LABELS[s]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      className: "min-w-32 text-right",
      sortValue: (m) => m.rate,
      cell: (m) => (
        <span className="tabular flex flex-col leading-tight text-right">
          <span className="font-medium">{formatMoney(money(m.rate))}</span>
          <span className="text-faint text-xs">
            {ENGAGEMENT_LABELS[m.basis]}
          </span>
        </span>
      ),
    },
    {
      key: "jobs",
      header: "Jobs",
      className: "min-w-20 text-right",
      sortValue: (m) => m.jobsCompleted,
      cell: (m) => <span className="tabular">{m.jobsCompleted}</span>,
    },
    {
      key: "dispatchable",
      header: "Can work",
      className: "min-w-40",
      sortValue: (m) => (workerDispatchable(m, now) ? 0 : 1),
      cell: (m) =>
        workerDispatchable(m, now) ? (
          <Badge
            variant="outline"
            className="border-success/40 bg-success-soft text-success"
          >
            Available
          </Badge>
        ) : (
          <span className="flex items-center gap-1.5">
            <CircleSlashIcon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-muted-foreground text-xs">
              {/* Says which of the four it is, in the order someone would act
                  on: a lapsed document is chased, a review is done, a roster
                  gap is just a fact. */}
              {!m.available
                ? "Off roster"
                : m.status === "pending"
                  ? "Awaiting review"
                  : m.status !== "verified"
                    ? "Not verified"
                    : "Document expired"}
            </span>
          </span>
        ),
    },
    {
      key: "status",
      header: "Verification",
      className: "min-w-32",
      sortValue: (m) => m.status,
      cell: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-36",
      cell: (m) => <ComplianceBadge documents={m.documents} now={now} />,
    },
    {
      key: "registered",
      header: "Registered",
      className: "min-w-28",
      sortValue: (m) => m.registeredAt.getTime(),
      cell: (m) => (
        <span className="text-muted-foreground text-sm">
          {relativeTime(m.registeredAt, now)}
        </span>
      ),
    },
  ];

  return (
    <EntityTable
      readOnly={readOnly}
      kind="workers"
      rows={crew}
      columns={columns}
      entityLabel="crew"
      searchPlaceholder="Name, mobile, village or skill"
      nameOf={(m) => m.name}
      searchText={(m) =>
        `${m.name} ${m.mobile} ${m.place} ${m.district} ${m.id} ${m.skills
          .map((s) => MANPOWER_SKILL_LABELS[s])
          .join(" ")} ${agencyNames?.[m.agencyId] ?? ""}`
      }
      card={(m) => (
        <>
          <div className="flex items-start gap-3">
            <EntityPhoto name={m.name} seed={m.id} photoUrl={m.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{m.name}</span>
              <span className="text-faint truncate text-xs">
                {m.place} · {m.district}
              </span>
            </span>
            <StatusBadge status={m.status} />
          </div>

          <span className="flex flex-wrap gap-1">
            {m.skills.map((s) => (
              <Badge key={s} variant="secondary">
                {MANPOWER_SKILL_LABELS[s]}
              </Badge>
            ))}
          </span>

          <span className="tabular flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {ENGAGEMENT_LABELS[m.basis]}
            </span>
            <span className="font-medium">{formatMoney(money(m.rate))}</span>
          </span>

          <DocumentList documents={m.documents} now={now} />
        </>
      )}
    />
  );
}
