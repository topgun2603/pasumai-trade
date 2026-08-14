"use client";

import {
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  TrashIcon,
  TriangleAlertIcon,
  TruckIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GRADE_LABELS, GRADES, unitLabel, type Grade } from "@/lib/domain/enums";
import {
  cartLineCount,
  cartTotal,
  freshness,
  FRESHNESS_LABELS,
  offerLineTotal,
  offerUnitPrice,
  resolveCart,
  type CartLine,
  type Freshness,
  type PickupArea,
  type StockOffer,
} from "@/lib/domain/market";
import { formatMoney } from "@/lib/domain/money";
import { produceName } from "@/lib/domain/models";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "price" | "distance" | "freshness";

const SORT_LABELS: Record<SortKey, string> = {
  distance: "Nearest first",
  price: "Cheapest first",
  freshness: "Shortest shelf life",
};

/**
 * `from 34 km`, or an honest blank.
 *
 * Distance is computed from the buyer's own location, so it is absent whenever
 * this buyer or the district's villages have not been pinned. Saying so beats
 * printing `from 0 km`, which reads as "next door".
 */
function fromKm(distanceKm: number | null): string {
  return distanceKm === null ? "distance not set" : `from ${distanceKm} km`;
}

const FRESHNESS_STYLE: Record<Freshness, string> = {
  fresh: "border-success/40 bg-success-soft text-success",
  useSoon: "border-warning/40 bg-warning-soft text-warning",
  endOfLife: "border-destructive/40 bg-destructive-soft text-destructive",
};

export function MarketBrowser({
  offers,
  sources,
  now,
}: {
  offers: StockOffer[];
  sources: PickupArea[];
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sort, setSort] = useState<SortKey>("distance");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = offers.filter((o) => {
      if (source !== "all" && o.source.districtId !== source) return false;
      if (grades.length > 0 && !grades.includes(o.sku.grade)) return false;
      if (!needle) return true;
      return (
        Object.values(o.sku.produce.names).some((name) =>
          name?.toLowerCase().includes(needle),
        ) ||
        o.source.district.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price") return a.pricePerUnit - b.pricePerUnit;
      // Unmeasured districts sort last: unknown is not near.
      if (sort === "distance") {
        return (
          (a.source.distanceKm ?? Infinity) - (b.source.distanceKm ?? Infinity)
        );
      }
      return a.bestBefore.getTime() - b.bestBefore.getTime();
    });
  }, [offers, query, source, grades, sort]);

  const baskets = useMemo(() => resolveCart(lines, offers), [lines, offers]);
  const total = cartTotal(baskets);
  const count = cartLineCount(lines);
  const blocked = baskets.filter((b) => !b.meetsMinimum);

  function setQuantity(offerId: string, quantity: number) {
    setLines((current) => {
      const rest = current.filter((l) => l.offerId !== offerId);
      return quantity > 0 ? [...rest, { offerId, quantity }] : rest;
    });
  }

  function quantityFor(offerId: string): number {
    return lines.find((l) => l.offerId === offerId)?.quantity ?? 0;
  }

  function placeOrders() {
    const dispatches = baskets.length;
    setLines([]);
    setCartOpen(false);
    toast.success(
      dispatches === 1
        ? "Order placed — 1 dispatch"
        : `Orders placed — ${dispatches} dispatches`,
      {
        description: `${formatMoney(total)} total. Each district is collected on its own vehicle run.`,
      },
    );
  }

  return (
    <>
      <header className="border-b px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Market</h1>
            <p className="text-muted-foreground text-sm">
              Graded stock available now. Prices move daily with the mandi and
              with shelf life, so what you see is today&rsquo;s rate.
            </p>
          </div>

          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button variant={count > 0 ? "default" : "outline"}>
                <ShoppingCartIcon className="size-4" />
                {count > 0 ? `${count} · ${formatMoney(total)}` : "Cart empty"}
              </Button>
            </SheetTrigger>

            <SheetContent className="flex w-full flex-col sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Your order</SheetTitle>
                <SheetDescription>
                  {baskets.length <= 1
                    ? "One district, one vehicle run — collected from the farms."
                    : `${baskets.length} districts — each is its own vehicle run, collected from the farms in it.`}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4">
                {baskets.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Nothing in the cart yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {baskets.map((basket) => (
                      <div
                        key={basket.source.districtId}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">
                            {basket.source.district}
                          </span>
                          <span className="text-faint text-xs">
                            {fromKm(basket.source.distanceKm)}
                          </span>
                        </div>
                        {/* The villages the vehicle will actually call at. */}
                        <p className="text-faint text-xs">
                          Collecting from {basket.stops.join(", ")}
                        </p>

                        {basket.lines.map((line) => (
                          <div
                            key={line.offer.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span aria-hidden>{line.offer.sku.produce.emoji}</span>
                              <span className="truncate">
                                {line.offer.sku.produce.names.en}{" "}
                                {GRADE_LABELS[line.offer.sku.grade]}
                              </span>
                              <span className="text-faint tabular shrink-0 text-xs">
                                × {formatQuantity(line.quantity)}{" "}
                                {unitLabel(line.offer.sku.unit)}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <span className="tabular">
                                {formatMoney(line.total)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(line.offer.id, 0)}
                                aria-label={`Remove ${line.offer.sku.produce.names.en}`}
                                className="text-faint hover:text-destructive focus-visible:ring-ring rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                              >
                                <TrashIcon className="size-3.5" />
                              </button>
                            </span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="tabular font-medium">
                            {formatMoney(basket.subtotal)}
                          </span>
                        </div>

                        {!basket.meetsMinimum ? (
                          <p className="text-warning flex items-start gap-1.5 text-xs">
                            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              Add {formatMoney(basket.shortfall)} more to reach
                              this point&rsquo;s{" "}
                              {formatMoney(basket.source.minOrderValue)} minimum
                              — a vehicle will not be dispatched below it.
                            </span>
                          </p>
                        ) : null}

                        <Separator />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <SheetFooter>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="tabular text-lg font-semibold">
                    {formatMoney(total)}
                  </span>
                </div>
                <p className="text-faint text-xs">
                  Final price is confirmed against the grade recorded at
                  collection. Funds are held in escrow until you confirm receipt.
                </p>
                <Button
                  onClick={placeOrders}
                  disabled={baskets.length === 0 || blocked.length > 0}
                >
                  {blocked.length > 0
                    ? `${blocked.length} below minimum`
                    : baskets.length > 1
                      ? `Place ${baskets.length} orders`
                      : "Place order"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <SearchIcon className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Crop or district"
            aria-label="Search stock"
            className="pl-8"
          />
        </div>

        {/* The label is passed as children of SelectValue rather than left to
            Radix to resolve. Radix normally portals the selected item's text
            into the value node inside an effect, which leaves the trigger
            blank during SSR. Supplying children sets `valueNodeHasChildren`,
            so that portal is skipped and no text is duplicated — while the
            value node itself still exists, which item-aligned positioning
            needs to place the dropdown. */}
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-56" aria-label="Filter by district">
            <SelectValue>
              {source === "all"
                ? "All districts"
                : (() => {
                    const s = sources.find((x) => x.districtId === source);
                    return s ? `${s.district} · ${fromKm(s.distanceKm)}` : "";
                  })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All districts</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.districtId} value={s.districtId}>
                {s.district} · {fromKm(s.distanceKm)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToggleGroup
          type="multiple"
          value={grades}
          onValueChange={(v) => setGrades(v as Grade[])}
          variant="outline"
          aria-label="Filter by grade"
        >
          {GRADES.map((g) => (
            <ToggleGroupItem key={g} value={g} aria-label={`Grade ${GRADE_LABELS[g]}`}>
              {GRADE_LABELS[g]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="ml-auto w-44" aria-label="Sort stock">
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Nearest first</SelectItem>
            <SelectItem value="price">Cheapest first</SelectItem>
            <SelectItem value="freshness">Shortest shelf life</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {visible.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            No stock matches these filters.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                now={now}
                quantity={quantityFor(offer.id)}
                onChange={(q) => setQuantity(offer.id, q)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function OfferCard({
  offer,
  now,
  quantity,
  onChange,
}: {
  offer: StockOffer;
  now: number;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const life = freshness(offer, now);
  const unit = unitLabel(offer.sku.unit);
  const step = offer.minOrderQuantity;
  const inCart = quantity > 0;

  return (
    <li className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="text-2xl leading-none">
            {offer.sku.produce.emoji}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-medium">
              {offer.sku.produce.names.en}
              <span className="text-muted-foreground ml-1.5 text-sm">
                Grade {GRADE_LABELS[offer.sku.grade]}
              </span>
            </span>
            <span lang="ta" className="text-faint text-xs">
              {produceName(offer.sku.produce, "ta", offer.source.district)}
            </span>
          </span>
        </div>
        <Badge variant="outline" className={cn("shrink-0", FRESHNESS_STYLE[life])}>
          {FRESHNESS_LABELS[life]}
        </Badge>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-xl font-semibold">
          {formatMoney(offerUnitPrice(offer))}
        </span>
        <span className="text-muted-foreground text-sm">/ {unit}</span>
        <span className="text-faint ml-auto text-xs">{offer.sku.packLabel}</span>
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span className="flex items-center gap-1.5">
          <MapPinIcon className="size-3.5 shrink-0" />
          {/* The village the vehicle stops at, then its district. Pickup is
              at the farm, so the place is the useful half. */}
          {offer.place}, {offer.source.district} · {fromKm(offer.source.distanceKm)}
        </span>
        <span className="flex items-center gap-1.5">
          <TruckIcon className="size-3.5 shrink-0" />
          <span className="tabular">
            {formatQuantity(offer.availableQuantity)} {unit}
          </span>
          available · min {formatQuantity(step)} {unit}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Decrease quantity"
            disabled={!inCart}
            onClick={() => onChange(Math.max(0, quantity - step))}
          >
            <MinusIcon className="size-4" />
          </Button>
          <Input
            value={inCart ? quantity : ""}
            onChange={(e) => {
              const next = Number(e.target.value.replace(/[^\d.]/g, ""));
              onChange(
                Number.isFinite(next)
                  ? Math.min(next, offer.availableQuantity)
                  : 0,
              );
            }}
            placeholder="0"
            inputMode="decimal"
            aria-label={`Quantity in ${unit}`}
            className="tabular w-20 text-center"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Increase quantity"
            disabled={quantity + step > offer.availableQuantity}
            onClick={() =>
              onChange(Math.min(offer.availableQuantity, quantity + step))
            }
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>

        {inCart ? (
          <span className="tabular ml-auto text-sm font-medium">
            {formatMoney(offerLineTotal(offer, quantity))}
          </span>
        ) : (
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={() => onChange(step)}
          >
            Add
          </Button>
        )}
      </div>

      {inCart && quantity < step ? (
        <p className="text-warning text-xs">
          Minimum is {formatQuantity(step)} {unit}.
        </p>
      ) : null}
    </li>
  );
}
