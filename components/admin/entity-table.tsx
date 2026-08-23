"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  DataTable,
  type Column,
  type FilterTab,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { VerificationStatus } from "@/lib/domain/admin";
import {
  MOVE_LABELS,
  RECORDS,
  type RecordKind,
} from "@/lib/domain/admin-records";

/**
 * A governed entity list.
 *
 * A thin specialisation of `DataTable` for anything with a verification
 * lifecycle — buyers, farmers, drivers, vehicles. It supplies the three
 * questions those records always raise (what is waiting, what is live, what is
 * stopped) and the approve/suspend actions. Everything else — search, sorting,
 * columns, pagination, the card toggle — comes from the shared table, so these
 * lists cannot drift from the rest of the app.
 */

interface HasStatus {
  readonly id: string;
  readonly status: VerificationStatus;
}

/**
 * What the menu offers, per status.
 *
 * The same shape as `canMove` in the domain, which is what the endpoint checks
 * against — this decides what is *shown*, that decides what is *allowed*, and
 * the server is the one that counts.
 */
const MOVES_FOR: Record<VerificationStatus, readonly VerificationStatus[]> = {
  pending: ["verified", "rejected"],
  verified: ["suspended"],
  rejected: ["verified"],
  suspended: ["verified"],
};

const VERIFICATION_TABS: readonly FilterTab<HasStatus>[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", match: (r) => r.status === "pending" },
  {
    value: "verified",
    label: "Verified",
    match: (r) => r.status === "verified",
  },
  {
    value: "blocked",
    label: "Stopped",
    match: (r) => r.status === "suspended" || r.status === "rejected",
  },
];

export function EntityTable<T extends HasStatus>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  entityLabel,
  nameOf,
  card,
  kind,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  entityLabel: string;
  nameOf: (row: T) => string;
  card?: (row: T) => ReactNode;
  /**
   * Which collection these rows live in.
   *
   * Required, and the reason the actions work at all: this table is shared by
   * seven admin screens and the menu previously knew neither the record's id
   * nor where it lived, so it could not have done anything even if it had
   * tried. It called `toast.success` instead.
   */
  kind: RecordKind;
}) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      searchText={searchText}
      searchPlaceholder={searchPlaceholder}
      entityLabel={entityLabel}
      card={card}
      tabs={VERIFICATION_TABS as readonly FilterTab<T>[]}
      rowActions={(row) => (
        <RowActions
          kind={kind}
          id={row.id}
          name={nameOf(row)}
          status={row.status}
        />
      )}
    />
  );
}

/**
 * Actions offered depend on where the record is in its lifecycle. A verified
 * account cannot be "approved" again, and a rejected one is reinstated rather
 * than approved — the wording matters because it is an audit trail.
 */
function RowActions({
  kind,
  id,
  name,
  status,
}: {
  kind: RecordKind;
  id: string;
  name: string;
  status: VerificationStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<VerificationStatus | null>(null);

  const record = RECORDS[kind];

  async function move(next: VerificationStatus) {
    const response = await fetch(`/api/admin/records/${kind}/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      toast.error(data.error ?? `Could not update ${name}.`);
      return;
    }

    toast.success(`${name} ${next === "verified" ? "approved" : next}`);
    /*
      Refresh rather than patch the row in place. The rail badges, the tab
      counts and the row all read the same status, and updating one of the
      three is how a console starts disagreeing with itself.
    */
    startTransition(() => router.refresh());
  }

  const offered = MOVES_FOR[status] ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`Actions for ${name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Offered only where there is a page to open. An item that opens
              nothing is the same defect in a smaller form. */}
          {record.dossier ? (
            <DropdownMenuItem asChild>
              <Link href={`/admin/consoles/${record.dossier}/${id}`}>
                View details
              </Link>
            </DropdownMenuItem>
          ) : null}

          {/* The queue is where a document is actually asked for, so this goes
              there rather than pretending to send something from here. */}
          <DropdownMenuItem asChild>
            <Link href="/admin/kyc">Request documents</Link>
          </DropdownMenuItem>

          {offered.length > 0 ? <DropdownMenuSeparator /> : null}

          {offered.map((next) => (
            <DropdownMenuItem
              key={next}
              variant={next === "verified" ? undefined : "destructive"}
              // Approving is reversible by suspending; refusing and suspending
              // are what somebody has to explain afterwards, so those ask.
              onClick={() =>
                next === "verified" ? void move(next) : setConfirming(next)
              }
            >
              {MOVE_LABELS[next]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`${confirming ? MOVE_LABELS[confirming] : ""} ${name}?`}
        description={
          confirming === "rejected"
            ? `${name} will be told the application was refused. The record is kept, and they can be approved later if they send what is missing.`
            : `${name} loses access immediately. The record is kept and can be reinstated.`
        }
        confirmLabel={confirming ? MOVE_LABELS[confirming] : ""}
        destructive
        onConfirm={() => {
          const next = confirming;
          setConfirming(null);
          if (next) void move(next);
        }}
      />
    </>
  );
}

// The four admin tables import `Column` from here; keep that working.
export type { Column };
