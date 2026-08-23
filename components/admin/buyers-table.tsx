"use client";

import { ComplianceBadge, StatusBadge } from "@/components/admin/badges";
import { EntityPhoto, MissingPhotoNote } from "@/components/admin/entity-photo";
import { EntityTable, type Column } from "@/components/admin/entity-table";
import type { RecordKind } from "@/lib/domain/admin-records";
import { Badge } from "@/components/ui/badge";
import { BUYER_KIND_LABELS, type BuyerAccount } from "@/lib/domain/admin";
import { formatMoney, isZero } from "@/lib/domain/money";
import { relativeTime } from "@/lib/format";

export function BuyersTable({
  accounts,
  now,
  kind = "buyers",
  readOnly = false,
}: {
  accounts: BuyerAccount[];
  now: number;
  /**
   * Which collection these rows are from.
   *
   * The franchises page renders this same table, and franchises live in their
   * own collection. Baking "buyers" in would have sent a franchise approval to
   * the wrong document — the row would not change and a buyer with a matching
   * id would.
   */
  kind?: RecordKind;
  /** Hides every row action. A franchise reads these screens, nothing more. */
  readOnly?: boolean;
}) {
  const columns: Column<BuyerAccount>[] = [
    {
      key: "name",
      header: "Account",
      className: "min-w-56",
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={a.name}
            seed={a.id}
            photoUrl={a.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{a.name}</span>
            <span className="text-faint truncate text-xs">
              {a.id} · {a.contactName} · {a.mobile}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Type",
      className: "min-w-28",
      cell: (a) => (
        <Badge variant={a.kind === "franchise" ? "secondary" : "outline"}>
          {BUYER_KIND_LABELS[a.kind]}
        </Badge>
      ),
    },
    {
      key: "base",
      header: "Base",
      className: "min-w-40",
      sortValue: (a) => `${a.district} ${a.town}`,
      cell: (a) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{a.town}</span>
          <span className="text-faint text-xs">{a.district}</span>
        </span>
      ),
    },
    {
      key: "trade",
      header: "Traded",
      className: "min-w-40",
      sortValue: (a) => a.lifetimeValue.minorUnits,
      cell: (a) =>
        isZero(a.lifetimeValue) ? (
          <span className="text-faint text-sm">No orders yet</span>
        ) : (
          <span className="flex flex-col leading-tight">
            <span className="tabular text-sm">
              {formatMoney(a.lifetimeValue)}
            </span>
            <span className="text-faint tabular text-xs">
              across {a.ordersPlaced} orders
            </span>
          </span>
        ),
    },
    {
      key: "documents",
      header: "Documents",
      className: "min-w-40",
      cell: (a) => <ComplianceBadge documents={a.documents} now={now} />,
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-32",
      cell: (a) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={a.status} />
          <span className="text-faint text-xs">
            {relativeTime(a.registeredAt, now)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <EntityTable
      readOnly={readOnly}
      kind={kind}
      rows={accounts}
      columns={columns}
      entityLabel="accounts"
      searchPlaceholder="Name, contact, town or ID"
      nameOf={(a) => a.name}
      searchText={(a) =>
        `${a.name} ${a.contactName} ${a.mobile} ${a.town} ${a.district} ${a.id}`
      }
      card={(a) => (
        <>
          <div className="flex items-start gap-3">
            <EntityPhoto name={a.name} seed={a.id} photoUrl={a.photoUrl} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-faint text-xs">
                {a.id} · {a.town}
              </span>
              <MissingPhotoNote photoUrl={a.photoUrl} />
            </span>
            <StatusBadge status={a.status} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant={a.kind === "franchise" ? "secondary" : "outline"}>
              {BUYER_KIND_LABELS[a.kind]}
            </Badge>
            <ComplianceBadge documents={a.documents} now={now} />
          </div>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Contact</dt>
            <dt className="text-faint text-xs">Traded</dt>
            <dd className="truncate">{a.contactName}</dd>
            <dd className="tabular">
              {isZero(a.lifetimeValue) ? "—" : formatMoney(a.lifetimeValue)}
            </dd>
            <dt className="text-faint pt-1 text-xs">Mobile</dt>
            <dt className="text-faint pt-1 text-xs">Orders</dt>
            <dd className="truncate">{a.mobile}</dd>
            <dd className="tabular">{a.ordersPlaced}</dd>
          </dl>
        </>
      )}
    />
  );
}
