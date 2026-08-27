"use client";

import { CloudOffIcon, ImageIcon } from "lucide-react";
import { useState } from "react";

import { QuoteDialog } from "@/components/franchise/quote-dialog";
import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatQuantity } from "@/lib/domain/quantity";
import { unitLabel } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/domain/money";
import {
  hasExpiredAt,
  marketHigh,
  marketLow,
  produceName,
  remainingFrom,
  type Listing,
} from "@/lib/domain/models";
import { countdown, relativeTime, shortDate } from "@/lib/format";

const HOUR = 3_600_000;

function isLive(listing: Listing, now: number): boolean {
  return (
    listing.status === "offered" &&
    !!listing.offer &&
    !hasExpiredAt(listing.offer, new Date(now))
  );
}

function isExpired(listing: Listing, now: number): boolean {
  return (
    listing.status === "offered" &&
    !!listing.offer &&
    hasExpiredAt(listing.offer, new Date(now))
  );
}

function OfferStatus({ listing, now }: { listing: Listing; now: number }) {
  if (listing.status !== "offered" || !listing.offer) {
    return <Badge variant="secondary">Awaiting quote</Badge>;
  }

  const nowDate = new Date(now);
  if (hasExpiredAt(listing.offer, nowDate)) {
    return <Badge variant="destructive">Expired</Badge>;
  }

  const soon = remainingFrom(listing.offer, nowDate) < HOUR;
  return (
    <Badge
      variant="outline"
      className={
        soon
          ? "border-warning/40 bg-warning-soft text-warning"
          : "border-success/40 bg-success-soft text-success"
      }
    >
      {countdown(listing.offer.expiresAt, now)}
    </Badge>
  );
}

export function ListingsTable({
  listings,
  areas,
  now,
}: {
  listings: Listing[];
  /**
   * The patches this franchise sources from. "Area" to the reader, `district`
   * on the record — see the note in suppliers-table.tsx.
   */
  areas: string[];
  now: number;
}) {
  const [area, setArea] = useState("all");
  const [quoting, setQuoting] = useState<Listing | null>(null);

  const rows =
    area === "all"
      ? listings
      : listings.filter((l) => l.farmer.district === area);

  const tabs: FilterTab<Listing>[] = [
    { value: "all", label: "All" },
    {
      value: "awaiting",
      label: "Awaiting quote",
      match: (l) => l.status === "awaitingOffer",
    },
    { value: "live", label: "Live", match: (l) => isLive(l, now) },
    { value: "expired", label: "Expired", match: (l) => isExpired(l, now) },
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
            <span lang="ta" className="text-faint text-xs">
              {produceName(l.produce, "ta", l.farmer.district)}
            </span>
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
            {l.farmer.village} · {l.farmer.completedOrders} orders
          </span>
        </span>
      ),
    },
    {
      key: "area",
      header: "Area",
      className: "min-w-32",
      sortValue: (l) => l.farmer.district,
      cell: (l) => (
        <span className="text-muted-foreground text-sm">{l.farmer.district}</span>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      className: "min-w-28 text-right",
      sortValue: (l) => l.quantity,
      cell: (l) => (
        <span className="tabular">
          <span className="text-sm font-medium">{formatQuantity(l.quantity, l.unit)}</span>
          <span className="text-faint ml-1 text-xs">{unitLabel(l.unit)}</span>
        </span>
      ),
    },
    {
      key: "mandi",
      header: "Mandi reference",
      className: "min-w-44",
      sortValue: (l) => l.marketRate.low,
      cell: (l) => (
        <span className="flex flex-col leading-tight">
          <span className="tabular text-sm">
            {formatMoney(marketLow(l.marketRate))} –{" "}
            {formatMoney(marketHigh(l.marketRate))}
          </span>
          <span className="text-faint text-xs">
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
      key: "status",
      header: "Status",
      className: "min-w-32",
      cell: (l) => (
        <div className="flex items-center gap-1.5">
          <OfferStatus listing={l} now={now} />
          {l.pendingSync ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-warning" tabIndex={0}>
                  <CloudOffIcon className="size-3.5" />
                  <span className="sr-only">Created offline, not yet synced</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Created offline — not yet confirmed by the server
              </TooltipContent>
            </Tooltip>
          ) : null}
          {l.photoCount === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-faint" tabIndex={0}>
                  <ImageIcon className="size-3.5" />
                  <span className="sr-only">No photos</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>No photos — quote at your own risk</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        tabs={tabs}
        entityLabel="listings"
        searchPlaceholder="Crop, farmer, village or listing ID"
        searchText={(l) =>
          `${Object.values(l.produce.names).join(" ")} ${l.farmer.name} ${l.farmer.village} ${l.id}`
        }
        toolbar={
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-44" aria-label="Filter by area">
              <SelectValue>
                {area === "all" ? "All areas" : area}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              {areas.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rowActions={(l) => (
          <Button
            size="sm"
            variant={l.status === "awaitingOffer" ? "default" : "outline"}
            onClick={() => setQuoting(l)}
          >
            {l.status === "awaitingOffer" ? "Quote" : "Requote"}
          </Button>
        )}
        card={(l) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="text-2xl leading-none">
                  {l.produce.emoji}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">{produceName(l.produce, "en")}</span>
                  <span className="text-faint text-xs">
                    {l.id} · {relativeTime(l.createdAt, now)}
                  </span>
                </span>
              </div>
              <OfferStatus listing={l} now={now} />
            </div>

            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-faint text-xs">Farmer</dt>
              <dt className="text-faint text-xs">Quantity</dt>
              <dd className="truncate">{l.farmer.name}</dd>
              <dd className="tabular">
                {formatQuantity(l.quantity, l.unit)}
              </dd>
            </dl>

            <p className="text-faint text-xs">
              {l.farmer.village}, {l.farmer.district} · Mandi{" "}
              {formatMoney(marketLow(l.marketRate))} –{" "}
              {formatMoney(marketHigh(l.marketRate))}
            </p>
          </>
        )}
      />

      {quoting ? (
        <QuoteDialog
          key={quoting.id}
          listing={quoting}
          now={now}
          onOpenChange={(open) => {
            if (!open) setQuoting(null);
          }}
        />
      ) : null}
    </>
  );
}
