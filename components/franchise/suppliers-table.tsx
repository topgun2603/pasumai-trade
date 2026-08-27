"use client";

import { PhoneIcon, SproutIcon } from "lucide-react";
import { useState } from "react";

import { EntityPhoto } from "@/components/admin/entity-photo";
import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canTransact, type FarmerAccount } from "@/lib/domain/admin";
import { relativeTime } from "@/lib/format";

export interface Supplier {
  readonly id: string;
  readonly account: FarmerAccount;
  /** Crops this farmer has listed, by English name. */
  readonly crops: readonly string[];
  readonly openListings: number;
}

/**
 * Farmers supplying this buyer.
 *
 * Read-only on purpose: no row actions. Farmer accounts belong to whoever
 * onboarded them, and a buyer editing a supplier's bank details is exactly the
 * failure the onboarding rule exists to prevent.
 */
export function SuppliersTable({
  suppliers,
  areas,
  now,
}: {
  suppliers: Supplier[];
  /**
   * The patches this franchise sources from.
   *
   * "Area" here, `district` on the account underneath. A franchise holds an
   * area; the platform's geography still calls the same shape a district, and
   * renaming the stored field to match a label would be a migration bought for
   * a word.
   */
  areas: string[];
  now: number;
}) {
  const [area, setArea] = useState("all");

  const rows =
    area === "all"
      ? suppliers
      : suppliers.filter((s) => s.account.district === area);

  const tabs: FilterTab<Supplier>[] = [
    { value: "all", label: "All" },
    {
      value: "listing",
      label: "Listing now",
      match: (s) => s.openListings > 0,
    },
    {
      value: "verified",
      label: "Verified",
      match: (s) => canTransact(s.account.status),
    },
  ];

  const columns: Column<Supplier>[] = [
    {
      key: "farmer",
      header: "Farmer",
      className: "min-w-52",
      sortValue: (s) => s.account.name,
      cell: ({ account }) => (
        <div className="flex items-center gap-2.5">
          <EntityPhoto
            name={account.name}
            seed={account.id}
            photoUrl={account.photoUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{account.name}</span>
            <span className="text-faint flex items-center gap-1 text-xs">
              <PhoneIcon className="size-3 shrink-0" />
              {account.mobile}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      className: "min-w-40",
      sortValue: (s) => `${s.account.district} ${s.account.village}`,
      cell: ({ account }) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{account.village}</span>
          <span className="text-faint text-xs">{account.district}</span>
        </span>
      ),
    },
    {
      key: "crops",
      header: "Crops listed",
      className: "min-w-48",
      cell: ({ crops }) =>
        crops.length === 0 ? (
          <span className="text-faint text-sm">Nothing listed yet</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {crops.map((crop) => (
              <Badge key={crop} variant="secondary">
                {crop}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: "completed",
      header: "Completed",
      className: "min-w-28 text-right tabular",
      sortValue: (s) => s.account.completedOrders,
      cell: ({ account }) => account.completedOrders,
    },
    {
      key: "open",
      header: "Open",
      className: "min-w-24 text-right tabular",
      sortValue: (s) => s.openListings,
      cell: ({ openListings }) =>
        openListings > 0 ? (
          <span className="text-primary inline-flex items-center gap-1 font-medium">
            <SproutIcon className="size-3.5" />
            {openListings}
          </span>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    {
      key: "since",
      header: "Since",
      className: "min-w-36",
      sortValue: (s) => s.account.registeredAt.getTime(),
      cell: ({ account }) => (
        <span className="text-muted-foreground text-sm">
          {relativeTime(account.registeredAt, now)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      tabs={tabs}
      entityLabel="suppliers"
      searchPlaceholder="Name, village or crop"
      searchText={(s) =>
        `${s.account.name} ${s.account.village} ${s.account.district} ${s.crops.join(" ")}`
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
      card={({ account, crops, openListings }) => (
        <>
          <div className="flex items-start gap-3">
            <EntityPhoto
              name={account.name}
              seed={account.id}
              photoUrl={account.photoUrl}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{account.name}</span>
              <span className="text-faint text-xs">
                {account.village}, {account.district}
              </span>
            </span>
          </div>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Completed</dt>
            <dt className="text-faint text-xs">Open listings</dt>
            <dd className="tabular">{account.completedOrders}</dd>
            <dd className="tabular">{openListings}</dd>
          </dl>

          {crops.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {crops.map((crop) => (
                <Badge key={crop} variant="secondary">
                  {crop}
                </Badge>
              ))}
            </span>
          ) : null}
        </>
      )}
    />
  );
}
