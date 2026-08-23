"use client";

import { CloudOffIcon, ImageIcon } from "lucide-react";

import {
  DataTable,
  type Column,
  type FilterTab,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/domain/quantity";
import { unitLabel } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/domain/money";
import {
  hasExpiredAt,
  marketHigh,
  marketLow,
  produceName,
  type Listing,
} from "@/lib/domain/models";
import { relativeTime, shortDate } from "@/lib/format";

/**
 * Listings across the whole platform, seen by operations rather than a buyer.
 *
 * The tabs are the moderation cases: created offline and not yet confirmed,
 * listed without photos, or priced against a platform average instead of a
 * published mandi rate. Each is a reason a listing might mislead someone.
 */
function isUnofficial(listing: Listing): boolean {
  return listing.marketRate.source.toLowerCase().includes("platform");
}

export function AdminListingsTable({
  listings,
  now,
}: {
  listings: Listing[];
  now: number;
}) {
  const tabs: FilterTab<Listing>[] = [
    { value: "all", label: "All" },
    { value: "unsynced", label: "Unsynced", match: (l) => l.pendingSync },
    { value: "noPhotos", label: "No photos", match: (l) => l.photoCount === 0 },
    { value: "staleRate", label: "Unofficial rate", match: isUnofficial },
  ];

  const columns: Column<Listing>[] = [
    {
      key: "produce",
      header: "Produce",
      className: "min-w-52",
      sortValue: (l) => produceName(l.produce, "en"),
      cell: (l) => (
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg leading-none">
            {l.produce.emoji}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{produceName(l.produce, "en")}</span>
            <span className="text-faint text-xs">{l.id}</span>
          </span>
        </div>
      ),
    },
    {
      key: "farmer",
      header: "Farmer",
      className: "min-w-44",
      sortValue: (l) => l.farmer.name,
      cell: (l) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{l.farmer.name}</span>
          <span className="text-faint text-xs">
            {l.farmer.village}, {l.farmer.district}
          </span>
        </span>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      className: "min-w-28 text-right",
      sortValue: (l) => l.quantity,
      cell: (l) => (
        <span className="tabular">
          <span className="text-sm">{formatQuantity(l.quantity, l.unit)}</span>
          <span className="text-faint ml-1 text-xs">{unitLabel(l.unit)}</span>
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate reference",
      className: "min-w-48",
      sortValue: (l) => l.marketRate.source,
      cell: (l) => (
        <span className="flex flex-col leading-tight">
          <span className="tabular text-sm">
            {formatMoney(marketLow(l.marketRate))} –{" "}
            {formatMoney(marketHigh(l.marketRate))}
          </span>
          <span
            className={
              isUnofficial(l) ? "text-warning text-xs" : "text-faint text-xs"
            }
          >
            {l.marketRate.source} · {shortDate(l.marketRate.asOf)}
          </span>
        </span>
      ),
    },
    {
      key: "listed",
      header: "Listed",
      className: "min-w-24",
      sortValue: (l) => l.createdAt.getTime(),
      cell: (l) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {relativeTime(l.createdAt, now)}
        </span>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      className: "min-w-36",
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.pendingSync ? (
            <Badge
              variant="outline"
              className="border-warning/40 bg-warning-soft text-warning gap-1"
            >
              <CloudOffIcon className="size-3" />
              Unsynced
            </Badge>
          ) : null}
          {l.photoCount === 0 ? (
            <Badge variant="outline" className="gap-1">
              <ImageIcon className="size-3" />
              No photos
            </Badge>
          ) : null}
          {!l.pendingSync && l.photoCount > 0 ? (
            <span className="text-faint text-xs">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "offer",
      header: "Offer",
      className: "min-w-28",
      cell: (l) =>
        l.offer ? (
          hasExpiredAt(l.offer, new Date(now)) ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-success/40 bg-success-soft text-success"
            >
              Live
            </Badge>
          )
        ) : (
          <Badge variant="secondary">None</Badge>
        ),
    },
  ];

  return (
    <DataTable
      rows={listings}
      columns={columns}
      tabs={tabs}
      entityLabel="listings"
      searchPlaceholder="Crop, farmer, district or listing ID"
      searchText={(l) =>
        `${Object.values(l.produce.names).join(" ")} ${l.farmer.name} ${l.farmer.district} ${l.id}`
      }
      card={(l) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="text-2xl leading-none">
                {l.produce.emoji}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-medium">
                  {produceName(l.produce, "en")}
                </span>
                <span className="text-faint text-xs">
                  {l.id} · {relativeTime(l.createdAt, now)}
                </span>
              </span>
            </div>
            {l.offer ? (
              hasExpiredAt(l.offer, new Date(now)) ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success-soft text-success"
                >
                  Live
                </Badge>
              )
            ) : (
              <Badge variant="secondary">No offer</Badge>
            )}
          </div>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Farmer</dt>
            <dt className="text-faint text-xs">Quantity</dt>
            <dd className="truncate">{l.farmer.name}</dd>
            <dd className="tabular">
              {formatQuantity(l.quantity, l.unit)}
            </dd>
          </dl>

          <p
            className={
              isUnofficial(l) ? "text-warning text-xs" : "text-faint text-xs"
            }
          >
            {l.marketRate.source} · {formatMoney(marketLow(l.marketRate))} –{" "}
            {formatMoney(marketHigh(l.marketRate))}
          </p>
        </>
      )}
    />
  );
}
