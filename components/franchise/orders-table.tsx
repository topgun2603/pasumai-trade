"use client";

import { MapPinIcon, TruckIcon } from "lucide-react";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { GRADE_LABELS, unitLabel } from "@/lib/domain/enums";
import { formatMoney, money } from "@/lib/domain/money";
import {
  BUYER_ORDER_LABELS,
  type BuyerOrderStatus,
} from "@/lib/domain/order-state";
import {
  isOpen,
  lineTotal,
  orderQuantity,
  orderTotal,
  type BuyerOrder,
} from "@/lib/domain/orders";
import { countdown, formatQuantity, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<BuyerOrderStatus, string> = {
  pendingPayment: "border-warning/40 bg-warning-soft text-warning",
  paid: "border-primary/40 bg-accent text-accent-foreground",
  allocated: "border-primary/40 bg-accent text-accent-foreground",
  inTransit: "border-primary/40 bg-accent text-accent-foreground",
  delivered: "border-success/40 bg-success-soft text-success",
  completed: "border-border bg-secondary text-muted-foreground",
  cancelled: "border-destructive/40 bg-destructive-soft text-destructive",
  refunded: "border-destructive/40 bg-destructive-soft text-destructive",
};

export function OrdersTable({
  orders,
  now,
}: {
  orders: BuyerOrder[];
  now: number;
}) {
  const tabs: FilterTab<BuyerOrder>[] = [
    { value: "open", label: "Open", match: isOpen },
    {
      value: "awaiting",
      label: "Awaiting dispatch",
      match: (o) => o.status === "paid" || o.status === "pendingPayment",
    },
    { value: "all", label: "All" },
  ];

  const columns: Column<BuyerOrder>[] = [
    {
      key: "reference",
      header: "Order",
      className: "min-w-36",
      sortValue: (o) => o.placedAt.getTime(),
      cell: (o) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{o.reference}</span>
          <span className="text-faint text-xs">{relativeTime(o.placedAt, now)}</span>
        </span>
      ),
    },
    {
      key: "pickup",
      header: "Pickup",
      className: "min-w-52",
      sortValue: (o) => o.distanceKm,
      cell: (o) => (
        <span className="flex flex-col leading-tight">
          <span className="text-sm">{o.district}</span>
          <span className="text-faint flex items-center gap-1 text-xs">
            <MapPinIcon className="size-3 shrink-0" />
            {/* The farms the vehicle calls at — collection is at the farm. */}
            {o.stops.join(", ")} · from {o.distanceKm} km
          </span>
        </span>
      ),
    },
    {
      key: "contents",
      header: "Contents",
      className: "min-w-44",
      sortValue: (o) => orderQuantity(o),
      cell: (o) => (
        <span className="flex items-center gap-1.5">
          {o.lines.slice(0, 3).map((line, i) => (
            <span key={`${line.produceId}-${i}`} aria-hidden>
              {line.emoji}
            </span>
          ))}
          <span className="text-muted-foreground tabular text-sm">
            {o.lines.length} line{o.lines.length === 1 ? "" : "s"} ·{" "}
            {formatQuantity(orderQuantity(o))}
          </span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "min-w-32 text-right",
      sortValue: (o) => orderTotal(o).minorUnits,
      cell: (o) => (
        <span className="tabular font-medium">{formatMoney(orderTotal(o))}</span>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      className: "min-w-40",
      sortValue: (o) => o.vehicleRegistration ?? "",
      cell: (o) =>
        o.vehicleRegistration ? (
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-1.5 font-mono text-sm">
              <TruckIcon className="text-faint size-3.5 shrink-0" />
              {o.vehicleRegistration}
            </span>
            <span className="text-faint text-xs">{o.driverName}</span>
          </span>
        ) : (
          <span className="text-faint text-sm">Not assigned</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-36",
      sortValue: (o) => o.status,
      cell: (o) => (
        <span className="flex flex-col items-start gap-1">
          <Badge variant="outline" className={cn(STATUS_STYLE[o.status])}>
            {BUYER_ORDER_LABELS[o.status]}
          </Badge>
          {o.status === "inTransit" && o.expectedArrival ? (
            <span className="text-faint text-xs">
              {countdown(o.expectedArrival, now)}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  function lines(order: BuyerOrder) {
    return (
      <>
        <ul className="flex flex-col gap-2">
          {order.lines.map((line, i) => (
            <li
              key={`${line.produceId}-${line.grade}-${i}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{line.emoji}</span>
                <span>{line.produceName}</span>
                <Badge variant="secondary">Grade {GRADE_LABELS[line.grade]}</Badge>
              </span>
              <span className="text-muted-foreground tabular flex items-center gap-4">
                <span>
                  {formatQuantity(line.quantity)} {unitLabel(line.unit)}
                </span>
                <span>
                  {formatMoney(money(line.unitPrice))}/{unitLabel(line.unit)}
                </span>
                <span className="text-foreground w-24 text-right font-medium">
                  {formatMoney(lineTotal(line))}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {/* Prices are what was agreed, not what the crop costs today — an
            order is a snapshot. */}
        <p className="text-faint mt-3 text-xs">
          Prices are those agreed when the order was placed. Final amounts
          resolve from the grade recorded at collection.
        </p>
      </>
    );
  }

  return (
    <DataTable
      rows={orders}
      columns={columns}
      tabs={tabs}
      entityLabel="orders"
      searchPlaceholder="Reference, crop or district"
      searchText={(o) =>
        `${o.reference} ${o.district} ${o.stops.join(" ")} ${o.lines.map((l) => l.produceName).join(" ")}`
      }
      expand={lines}
      card={(o) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{o.reference}</span>
              <span className="text-faint text-xs">
                {o.district} · {relativeTime(o.placedAt, now)}
              </span>
            </span>
            <Badge variant="outline" className={cn(STATUS_STYLE[o.status])}>
              {BUYER_ORDER_LABELS[o.status]}
            </Badge>
          </div>

          <span className="flex items-center gap-1.5">
            {o.lines.map((line, i) => (
              <span key={i} aria-hidden className="text-lg">
                {line.emoji}
              </span>
            ))}
            <span className="text-muted-foreground tabular text-sm">
              {formatQuantity(orderQuantity(o))}
            </span>
          </span>

          <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-faint text-xs">Total</dt>
            <dt className="text-faint text-xs">Vehicle</dt>
            <dd className="tabular font-medium">{formatMoney(orderTotal(o))}</dd>
            <dd className="truncate font-mono text-xs">
              {o.vehicleRegistration ?? "—"}
            </dd>
          </dl>
        </>
      )}
    />
  );
}
