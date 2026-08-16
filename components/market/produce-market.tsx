"use client";

import { HandshakeIcon, MapPinIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { OpenBargainDialog } from "@/components/market/open-bargain-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import type { VocabularyEntry } from "@/lib/domain/bargain-vocabulary";
import { formatMoney } from "@/lib/domain/money";
import type { MarketListing } from "@/lib/firebase/listings-read";
import { mediaItems } from "@/lib/media";

/**
 * What is for sale, as a buyer sees it.
 *
 * Real listings, posted by real farmers, replacing a catalogue of mock stock.
 * The photograph leads for the same reason it does on the farmer's side: a
 * buyer three districts away is deciding on pictures, and a column of rows all
 * reading "Tomato · 800 kg" is not a market.
 *
 * The asking price is shown per grade rather than as one figure. A buyer who
 * only wants grade A should be able to see what grade A costs without opening
 * anything, because that is the entire question they arrived with.
 */
export function ProduceMarket({
  listings,
  openThreads,
  vocabulary,
}: {
  listings: MarketListing[];
  /** Listing ids this buyer already has a live bargain on. */
  openThreads: Record<string, string>;
  /** What a buyer may say when opening a bargain, from Controls. */
  vocabulary: readonly VocabularyEntry[];
}) {
  const [bargaining, setBargaining] = useState<MarketListing | null>(null);

  const grades = (l: MarketListing) =>
    l.grades.length > 0 ? (
      <span className="flex flex-wrap gap-1">
        {l.grades.map((g) => (
          <span key={g.grade} className="bg-secondary rounded px-1.5 py-0.5 text-xs">
            <span className="font-medium">{g.grade.toUpperCase()}</span>{" "}
            <span className="tabular-nums">
              {g.quantity} {l.unit}
            </span>
            {g.askingRate ? (
              <span className="text-primary ml-1 tabular-nums">
                {formatMoney({ minorUnits: g.askingRate, currency: "INR" })}
              </span>
            ) : (
              <span className="text-faint ml-1">offers</span>
            )}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-faint text-xs">grade not stated</span>
    );

  const action = (l: MarketListing) => {
    const thread = openThreads[l.id];
    return thread ? (
      <Button asChild size="sm" variant="outline">
        <Link href="/bargains">
          <MessageSquareIcon className="size-3.5" />
          Bargaining
        </Link>
      </Button>
    ) : (
      <Button size="sm" onClick={() => setBargaining(l)}>
        <HandshakeIcon className="size-3.5" />
        Bargain
      </Button>
    );
  };

  const columns: Column<MarketListing>[] = [
    {
      key: "produce",
      header: "Produce",
      sortValue: (l) => l.produceName,
      cell: (l) => (
        <span className="flex items-center gap-2.5">
          <Carousel
            items={mediaItems(l.imageUrls, l.videoUrl)}
            alt={l.produceName}
            aspect="size-10"
            className="shrink-0"
            compact
          />
          <span className="font-medium">{l.produceName}</span>
        </span>
      ),
    },
    { key: "grades", header: "Grades and asking price", cell: grades },
    {
      key: "quantity",
      header: "Total",
      className: "text-right",
      sortValue: (l) => l.quantity,
      cell: (l) => (
        <span className="tabular-nums">
          {l.quantity} {l.unit}
        </span>
      ),
    },
    {
      key: "farmer",
      header: "Farmer",
      sortValue: (l) => l.farmerName,
      cell: (l) => (
        <span className="flex flex-col leading-tight">
          <span>{l.farmerName}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPinIcon className="size-3" />
            {l.village}, {l.district}
          </span>
        </span>
      ),
    },
    {
      key: "trust",
      header: "Sold before",
      className: "text-right",
      sortValue: (l) => l.completedOrders,
      cell: (l) => (
        <span className="tabular-nums">
          {l.completedOrders > 0 ? (
            `${l.completedOrders} orders`
          ) : (
            <span className="text-faint text-xs">first sale</span>
          )}
        </span>
      ),
    },
    {
      key: "posted",
      header: "Posted",
      sortValue: (l) => l.createdAt.getTime(),
      cell: (l) => (
        <span className="text-muted-foreground text-xs">
          {l.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      ),
    },
  ];

  const districts = [...new Set(listings.map((l) => l.district))].filter(Boolean).sort();

  const tabs: FilterTab<MarketListing>[] = [
    { value: "all", label: "All" },
    { value: "bargaining", label: "Bargaining", match: (l) => Boolean(openThreads[l.id]) },
    { value: "priced", label: "Priced", match: (l) => l.grades.some((g) => g.askingRate) },
    ...districts.slice(0, 3).map((district) => ({
      value: district,
      label: district,
      match: (l: MarketListing) => l.district === district,
    })),
  ];

  const card = (l: MarketListing) => (
    <div className="flex flex-col gap-3">
      <Carousel items={mediaItems(l.imageUrls, l.videoUrl)} alt={l.produceName} />

      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{l.produceName}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {l.quantity} {l.unit}
        </span>
      </div>

      {grades(l)}

      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <MapPinIcon className="size-3" />
        {l.farmerName} · {l.village}, {l.district}
        {l.completedOrders > 0 ? (
          <Badge variant="outline" className="ml-1">
            {l.completedOrders} sold
          </Badge>
        ) : null}
      </span>
    </div>
  );

  return (
    <>
      <DataTable
        rows={listings}
        columns={columns}
        tabs={tabs}
        card={card}
        rowActions={action}
        entityLabel="lots"
        searchPlaceholder="Search crop, farmer or village"
        searchText={(l) => `${l.produceName} ${l.farmerName} ${l.village} ${l.district}`}
      />

      <OpenBargainDialog
        listing={bargaining}
        vocabulary={vocabulary}
        onOpenChange={(open) => {
          if (!open) setBargaining(null);
        }}
      />
    </>
  );
}
