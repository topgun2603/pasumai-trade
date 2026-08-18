"use client";

import {
  CheckCircle2Icon,
  MapPinIcon,
  SnowflakeIcon,
  TruckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLE_TYPE_LABELS, type DriverAccount, type Vehicle } from "@/lib/domain/admin";
import { formatMoney } from "@/lib/domain/money";
import {
  canAdvanceBuyerOrder,
  driverDispatchable,
  vehicleDispatchable,
} from "@/lib/domain/order-state";
import { orderQuantity, orderTotal, type BuyerOrder } from "@/lib/domain/orders";
import { formatQuantity, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Assigning a vehicle and driver to a paid order.
 *
 * This is the first screen where the transition guards are the product rather
 * than a test. Every vehicle and driver is checked with the same
 * `vehicleDispatchable` / `driverDispatchable` used by the state machine, and
 * an ineligible one is shown **with its reason** instead of being hidden —
 * an operator who cannot see why a truck is unavailable will phone someone to
 * ask, and the answer is already known.
 *
 * Assigning then runs the real `paid → allocated` transition. If it refuses,
 * the refusal message is what the operator sees; nothing here re-implements
 * the rule or second-guesses it.
 */
export function DispatchBoard({
  orders,
  fleet,
  drivers,
  now,
}: {
  orders: BuyerOrder[];
  fleet: Vehicle[];
  drivers: DriverAccount[];
  now: number;
}) {
  const [assignment, setAssignment] = useState<
    Record<string, { vehicle?: string; driver?: string }>
  >({});

  const awaiting = orders.filter((o) => o.status === "paid");
  const allocated = orders.filter(
    (o) => o.status === "allocated" || o.status === "inTransit",
  );

  // Evaluated once and reused for every order — eligibility depends on the
  // vehicle's own documents, not on which load it is being considered for.
  const fleetStatus = fleet.map((vehicle) => ({
    vehicle,
    check: vehicleDispatchable(vehicle, now),
  }));
  const driverStatus = drivers.map((driver) => ({
    driver,
    check: driverDispatchable(driver, now),
  }));

  const usableVehicles = fleetStatus.filter((v) => v.check.allowed).length;
  const usableDrivers = driverStatus.filter((d) => d.check.allowed).length;

  function assign(order: BuyerOrder) {
    const picked = assignment[order.id] ?? {};
    const vehicle = fleet.find((v) => v.registration === picked.vehicle);
    const driver = drivers.find((d) => d.name === picked.driver);

    const result = canAdvanceBuyerOrder("paid", "allocated", "platform", {
      now,
      vehicle,
      driver,
    });

    if (!result.allowed) {
      toast.error("Cannot dispatch", { description: result.refusal.message });
      return;
    }

    toast.success(`${order.reference} allocated`, {
      description: `${picked.vehicle} · ${picked.driver}`,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Awaiting dispatch", value: awaiting.length, tone: "warning" as const },
          { label: "On the road", value: allocated.length, tone: "default" as const },
          {
            label: "Vehicles available",
            value: usableVehicles,
            hint: `of ${fleet.length} in the fleet`,
            tone: fleet.length - usableVehicles > 0 ? ("danger" as const) : ("default" as const),
          },
          {
            label: "Drivers available",
            value: usableDrivers,
            hint: `of ${drivers.length} registered`,
            tone: drivers.length - usableDrivers > 0 ? ("danger" as const) : ("default" as const),
          },
        ].map((tile) => (
          <div key={tile.label} className="bg-card flex flex-col gap-0.5 px-5 py-4">
            <span
              className={cn(
                "tabular text-2xl leading-none font-semibold",
                tile.tone === "warning" && tile.value > 0 && "text-warning",
                tile.tone === "danger" && "text-destructive",
              )}
            >
              {tile.value}
            </span>
            <span className="text-sm font-medium">{tile.label}</span>
            {tile.hint ? (
              <span className="text-faint text-xs">{tile.hint}</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Ineligible resources, stated once with reasons. */}
      {fleetStatus.some((v) => !v.check.allowed) ||
      driverStatus.some((d) => !d.check.allowed) ? (
        <div className="border-destructive/40 bg-destructive-soft flex flex-col gap-2 rounded-lg border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlertIcon className="text-destructive size-4 shrink-0" />
            Not available for dispatch
          </p>
          {/* The refusal already names its subject, so the list does not
              repeat it. These strings come straight from the state machine —
              whatever it would tell a route handler is what an operator
              reads. */}
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
            {[...fleetStatus, ...driverStatus]
              .map((entry) => entry.check)
              .filter((check) => !check.allowed)
              .map((check, index) => (
                <li key={index}>
                  {!check.allowed ? check.refusal.message : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Awaiting dispatch</h2>

        {awaiting.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            tone="done"
            title="Every paid order has a vehicle"
            description="Nothing is sitting waiting for transport. A paid order appears here the moment it is placed, with the vehicles and drivers that can carry it."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {awaiting.map((order) => {
              const picked = assignment[order.id] ?? {};
              const ready = Boolean(picked.vehicle && picked.driver);

              return (
                <li key={order.id} className="bg-card flex flex-col gap-4 rounded-lg border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{order.reference}</span>
                        <Badge variant="secondary">
                          Paid {relativeTime(order.paidAt ?? order.placedAt, now)}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        {order.district} · calling at {order.stops.join(", ")} ·
                        from {order.distanceKm} km
                      </span>
                      <span className="text-faint tabular text-sm">
                        {formatQuantity(orderQuantity(order))} across{" "}
                        {order.lines.length} line
                        {order.lines.length === 1 ? "" : "s"} ·{" "}
                        {formatMoney(orderTotal(order))}
                      </span>
                    </div>

                    <span className="flex items-center gap-1.5">
                      {order.lines.map((line, i) => (
                        <span key={i} aria-hidden className="text-lg">
                          {line.emoji}
                        </span>
                      ))}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Vehicle</span>
                      <Select
                        value={picked.vehicle ?? ""}
                        onValueChange={(v) =>
                          setAssignment((a) => ({
                            ...a,
                            [order.id]: { ...a[order.id], vehicle: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a vehicle">
                            {picked.vehicle}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {fleetStatus.map(({ vehicle, check }) => (
                            <SelectItem
                              key={vehicle.id}
                              value={vehicle.registration}
                              disabled={!check.allowed}
                            >
                              <span className="flex min-w-0 flex-col leading-tight">
                                <span className="flex items-center gap-1.5 font-mono">
                                  {vehicle.registration}
                                  {vehicle.refrigerated ? (
                                    <SnowflakeIcon className="size-3" />
                                  ) : null}
                                </span>
                                <span className="text-faint text-xs">
                                  {check.allowed
                                    ? `${VEHICLE_TYPE_LABELS[vehicle.type]} · ${formatQuantity(vehicle.capacityKg)} kg`
                                    : check.refusal.message}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Driver</span>
                      <Select
                        value={picked.driver ?? ""}
                        onValueChange={(v) =>
                          setAssignment((a) => ({
                            ...a,
                            [order.id]: { ...a[order.id], driver: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a driver">
                            {picked.driver}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {driverStatus.map(({ driver, check }) => (
                            <SelectItem
                              key={driver.id}
                              value={driver.name}
                              disabled={!check.allowed}
                            >
                              <span className="flex min-w-0 flex-col leading-tight">
                                <span>{driver.name}</span>
                                <span className="text-faint text-xs">
                                  {check.allowed
                                    ? `${driver.district} · ${driver.tripsCompleted} trips`
                                    : check.refusal.message}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <Button disabled={!ready} onClick={() => assign(order)}>
                      <TruckIcon className="size-4" />
                      Dispatch
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">On the road</h2>

        {allocated.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-lg border p-6 text-center text-sm">
            Nothing in transit.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allocated.map((order) => {
              // A vehicle can lapse after it was assigned. Re-checked on every
              // render rather than trusted from assignment time.
              const vehicle = fleet.find(
                (v) => v.registration === order.vehicleRegistration,
              );
              const check = vehicle ? vehicleDispatchable(vehicle, now) : null;
              const grounded = check ? !check.allowed : false;

              return (
                <li key={order.id} className="bg-card flex flex-col gap-2 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{order.reference}</span>
                    <Badge
                      variant="outline"
                      className={
                        grounded
                          ? "border-destructive/40 bg-destructive-soft text-destructive"
                          : "border-success/40 bg-success-soft text-success"
                      }
                    >
                      {grounded ? "Grounded" : "Rolling"}
                    </Badge>
                  </div>

                  <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <TruckIcon className="size-3.5 shrink-0" />
                    <span className="font-mono">{order.vehicleRegistration}</span>
                    <span className="text-faint">· {order.driverName}</span>
                  </span>

                  <span className="text-faint text-sm">
                    {order.district} · {order.distanceKm} km
                  </span>

                  {grounded && check && !check.allowed ? (
                    <p className="text-destructive flex items-start gap-1.5 text-xs">
                      <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                      {check.refusal.message} Reassign before it moves again.
                    </p>
                  ) : (
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <CheckCircle2Icon className="size-3 shrink-0" />
                      Documents in date
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
