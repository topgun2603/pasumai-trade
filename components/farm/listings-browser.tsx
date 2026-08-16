"use client";

import {
  ArchiveIcon,
  HandshakeIcon,
  ImageOffIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  VideoIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BargainPanel } from "@/components/farm/bargain-panel";
import { EditListingDialog } from "@/components/farm/edit-listing-dialog";
import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuickReply } from "@/components/negotiation/bargain-thread";
import type { Negotiation } from "@/lib/domain/negotiation";
import type { FarmListing } from "@/lib/firebase/listings-read";

/**
 * The farmer's produce, through the same grid as every other list.
 *
 * Table and cards, search, sorting, filter tabs and pagination all come from
 * `DataTable` rather than being rebuilt here — that component exists precisely
 * because four hand-rolled grids had four different ideas of what a filter was.
 * What this adds is the columns, the card, and what the row can do.
 */
export function ListingsBrowser({
  listings,
  threadsByListing,
  now,
  quickReplies,
  validForMinutes,
  editable,
  crops,
}: {
  listings: FarmListing[];
  /** Open bargains only, keyed by listing id. History lives on its own page. */
  threadsByListing: Record<string, Negotiation[]>;
  now: number;
  quickReplies: readonly QuickReply[];
  validForMinutes: number;
  editable: boolean;
  crops: Array<{ id: string; en: string; unit: string }>;
}) {
  const router = useRouter();
  const [bargaining, setBargaining] = useState<FarmListing | null>(null);
  const [editing, setEditing] = useState<FarmListing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(listing: FarmListing, action: "withdraw" | "relist" | "delete") {
    if (action === "delete") {
      // A listing with photographs is a few minutes of somebody's afternoon, so
      // deleting one asks first. Withdrawing does not — it is reversible.
      const ok = window.confirm(
        `Delete this ${listing.produceName} listing and its photos? This cannot be undone.`,
      );
      if (!ok) return;
    }

    setBusy(listing.id);
    const response = await fetch(`/api/listings/${listing.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "content-type": "application/json" },
      body:
        action === "delete"
          ? undefined
          : JSON.stringify({ status: action === "withdraw" ? "withdrawn" : "awaitingOffer" }),
    }).catch(() => null);

    setBusy(null);

    if (!response?.ok) {
      const detail = await response?.json().catch(() => ({}));
      toast.error(detail?.error ?? "Could not do that.");
      return;
    }

    toast.success(
      action === "delete"
        ? "Listing deleted"
        : action === "withdraw"
          ? "Taken off the market"
          : "Back on the market",
    );
    router.refresh();
  }

  const openCount = (listing: FarmListing) => threadsByListing[listing.id]?.length ?? 0;

  /*
    Every listing with someone bargaining on it, in the order they appear.

    A farmer with offers on four lots answers them one after another. Handing
    the panel the whole set lets it step between them in place — closing and
    reopening four times, hunting the right row each time, is the version of
    this that gets abandoned halfway.
  */
  const withBargains = listings.filter((l) => openCount(l) > 0);

  const gradeChips = (listing: FarmListing) =>
    listing.grades.length > 0 ? (
      <span className="flex flex-wrap gap-1">
        {listing.grades.map((g) => (
          <span key={g.grade} className="bg-secondary rounded px-1.5 py-0.5 text-xs">
            <span className="font-medium">{g.grade.toUpperCase()}</span>{" "}
            <span className="tabular-nums">{g.quantity}</span>
          </span>
        ))}
      </span>
    ) : (
      <span className="text-faint text-xs">grade not stated</span>
    );

  const columns: Column<FarmListing>[] = [
    {
      key: "produce",
      header: "Produce",
      sortValue: (l) => l.produceName,
      cell: (l) => (
        <span className="flex items-center gap-2.5">
          {l.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.imageUrls[0]}
              alt=""
              className="size-9 shrink-0 rounded object-cover"
            />
          ) : (
            <span className="bg-secondary text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded">
              <ImageOffIcon className="size-4" />
            </span>
          )}
          <span className="font-medium">{l.produceName}</span>
        </span>
      ),
    },
    { key: "grades", header: "Grades", cell: gradeChips },
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
      key: "media",
      header: "Media",
      cell: (l) => (
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          {l.imageUrls.length} photo{l.imageUrls.length === 1 ? "" : "s"}
          {l.videoUrl ? <VideoIcon className="size-3.5" /> : null}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (l) => l.status,
      cell: (l) =>
        l.status === "withdrawn" ? (
          <Badge variant="outline" className="text-muted-foreground">
            Withdrawn
          </Badge>
        ) : openCount(l) > 0 ? (
          <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
            {openCount(l)} bargaining
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            No offers yet
          </Badge>
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

  const tabs: FilterTab<FarmListing>[] = [
    { value: "all", label: "All" },
    {
      value: "bargaining",
      label: "Bargaining",
      match: (l) => openCount(l) > 0,
    },
    {
      value: "waiting",
      label: "No offers",
      match: (l) => l.status !== "withdrawn" && openCount(l) === 0,
    },
    { value: "withdrawn", label: "Withdrawn", match: (l) => l.status === "withdrawn" },
  ];

  const actions = (l: FarmListing) => (
    <span className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant={openCount(l) > 0 ? "default" : "outline"}
        disabled={busy === l.id}
        onClick={() => setBargaining(l)}
      >
        <HandshakeIcon className="size-3.5" />
        Bargain
        {openCount(l) > 0 ? ` (${openCount(l)})` : ""}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy === l.id} aria-label="More">
            ⋯
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(l)}>
            <PencilIcon className="size-3.5" />
            Edit quantities
          </DropdownMenuItem>
          {l.status === "withdrawn" ? (
            <DropdownMenuItem onClick={() => act(l, "relist")}>
              <RotateCcwIcon className="size-3.5" />
              Put back on the market
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => act(l, "withdraw")}>
              <ArchiveIcon className="size-3.5" />
              Take off the market
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => act(l, "delete")}>
            <Trash2Icon className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );

  const card = (l: FarmListing) => (
    <div className="flex flex-col gap-3">
      <div className="bg-secondary relative aspect-[4/3] overflow-hidden rounded-md">
        {l.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.imageUrls[0]} alt={l.produceName} className="size-full object-cover" />
        ) : (
          <span className="text-muted-foreground flex size-full items-center justify-center">
            <ImageOffIcon className="size-6" />
          </span>
        )}
        {l.imageUrls.length > 1 ? (
          <span className="bg-background/85 absolute right-1.5 bottom-1.5 rounded px-1.5 text-[11px] tabular-nums">
            +{l.imageUrls.length - 1}
          </span>
        ) : null}
        {l.videoUrl ? (
          <span className="bg-background/85 absolute top-1.5 left-1.5 rounded p-1">
            <VideoIcon className="size-3" />
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{l.produceName}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {l.quantity} {l.unit}
        </span>
      </div>

      {gradeChips(l)}
    </div>
  );

  return (
    <>
      <DataTable
        rows={listings}
        columns={columns}
        tabs={tabs}
        card={card}
        rowActions={actions}
        entityLabel="listings"
        searchPlaceholder="Search your produce"
        searchText={(l) =>
          `${l.produceName} ${l.status} ${l.grades.map((g) => g.grade).join(" ")} ${l.quantity}`
        }
      />

      <BargainPanel
        listing={bargaining}
        threads={bargaining ? (threadsByListing[bargaining.id] ?? []) : []}
        // Only offered when the one being viewed is itself in the set. Opening
        // a listing with no offers is a dead end by definition, and stepping
        // "next" from it would jump somewhere unrelated.
        siblings={bargaining && openCount(bargaining) > 0 ? withBargains : []}
        onSelect={setBargaining}
        now={now}
        quickReplies={quickReplies}
        validForMinutes={validForMinutes}
        editable={editable}
        onOpenChange={(open) => {
          if (!open) setBargaining(null);
        }}
      />

      <EditListingDialog
        listing={editing}
        crops={crops}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
