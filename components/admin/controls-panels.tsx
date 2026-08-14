"use client";

import {
  ChevronRightIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CropDialog } from "@/components/admin/crop-dialog";
import { CropIcon } from "@/components/admin/crop-icon";
import {
  DeleteDialog,
  DistrictDialog,
  PlaceDialog,
  StateDialog,
} from "@/components/admin/location-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VEHICLE_TYPE_LABELS } from "@/lib/domain/admin";
import { GRADE_LABELS, GRADES, QUANTITY_UNITS } from "@/lib/domain/enums";
import { isPoint } from "@/lib/domain/distance";
import { formatMoney, money } from "@/lib/domain/money";
import type { PlatformPolicy } from "@/lib/domain/policy";
import {
  districtSummary,
  type District,
  type Geography,
  type Place,
  type State,
} from "@/lib/domain/location";
import type { Produce } from "@/lib/domain/models";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Reference data, with the CRUD to maintain it.
 *
 * Everything here feeds a dropdown or a filter somewhere else, which is why it
 * needs an editor: a crop operations cannot rename is a crop a farmer cannot
 * find in the picker, and waiting for a deploy to fix a word is how a
 * catalogue ends up wrong for a season.
 *
 * Deactivate is offered more prominently than delete throughout. Deactivating
 * removes a record from every dropdown while leaving the listings, orders and
 * addresses that already reference it intact; deleting is refused outright by
 * the API when anything still depends on it.
 */

function ActivePill({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-success/40 bg-success-soft text-success"
          : "border-border bg-secondary text-muted-foreground"
      }
    >
      {active ? on : off}
    </Badge>
  );
}

/* -------------------------------------------------------------------------
   Crops
   ------------------------------------------------------------------------- */

export function CropCatalogue({
  crops,
  districts,
  editable,
}: {
  crops: readonly Produce[];
  districts: readonly District[];
  editable: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Produce | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Produce | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return crops;
    return crops.filter((c) =>
      Object.values(c.names).some((n) => n?.toLowerCase().includes(needle)),
    );
  }, [crops, query]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Produce catalogue</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Feeds the farmer&rsquo;s crop picker, the market filters and every
            listing. Names are held per language because they vary regionally —
            a crop called one thing in Erode may be called another in Thanjavur,
            and the farmer must see the word their village uses.
          </p>
        </div>
        <Button disabled={!editable} onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          Add crop
        </Button>
      </div>

      <div className="relative max-w-xs">
        <SearchIcon className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in any language"
          aria-label="Search crops"
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Crop</TableHead>
              {LOCALES.filter((l) => l !== "en").map((l) => (
                <TableHead key={l} className="min-w-32">
                  <span lang={LOCALE_META[l].tag}>{LOCALE_META[l].nativeName}</span>
                </TableHead>
              ))}
              <TableHead className="min-w-28">Coverage</TableHead>
              <TableHead className="min-w-24 text-right">Shelf life</TableHead>
              <TableHead className="min-w-28">Grading</TableHead>
              <TableHead className="min-w-24">Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={LOCALES.length + 5} className="h-24 text-center">
                  <span className="text-muted-foreground text-sm">
                    No crops match that search.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((crop) => {
                const named = LOCALES.filter((l) => crop.names[l]).length;
                const complete = named === LOCALES.length;

                const active = crop.active !== false;
                const graded = GRADES.filter((g) => crop.grading?.[g]?.en).length;

                return (
                  <TableRow key={crop.id} className={active ? undefined : "opacity-60"}>
                    <TableCell>
                      <span className="flex items-center gap-2.5">
                        <CropIcon
                          emoji={crop.emoji}
                          iconUrl={crop.iconUrl}
                          name={crop.names.en}
                        />
                        <span className="flex flex-col leading-tight">
                          <span className="font-medium">{crop.names.en}</span>
                          <span className="text-faint text-xs">
                            {crop.id} · {QUANTITY_UNITS[crop.defaultUnit].en}
                          </span>
                        </span>
                      </span>
                    </TableCell>

                    {LOCALES.filter((l) => l !== "en").map((l) => (
                      <TableCell key={l}>
                        {crop.names[l] ? (
                          <span lang={LOCALE_META[l].tag} className="text-sm">
                            {crop.names[l]}
                          </span>
                        ) : (
                          <span className="text-warning text-xs">Not named</span>
                        )}
                      </TableCell>
                    ))}

                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "tabular",
                          complete
                            ? "border-success/40 bg-success-soft text-success"
                            : "border-warning/40 bg-warning-soft text-warning",
                        )}
                      >
                        {named}/{LOCALES.length}
                      </Badge>
                      {crop.regional && Object.keys(crop.regional).length > 0 ? (
                        <span className="text-faint mt-1 block text-xs">
                          {Object.keys(crop.regional).length} district override
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="tabular text-right">
                      {crop.shelfLifeHours ? (
                        `${crop.shelfLifeHours}h`
                      ) : (
                        <span className="text-faint text-xs">default</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {graded === GRADES.length ? (
                        <Badge
                          variant="outline"
                          className="border-success/40 bg-success-soft text-success"
                        >
                          Defined
                        </Badge>
                      ) : (
                        // A crop with no written standard is a crop whose grade
                        // is decided by whoever is holding the crate.
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning-soft text-warning tabular"
                        >
                          {graded}/{GRADES.length}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <ActivePill active={active} on="Listed" off="Retired" />
                    </TableCell>

                    <TableCell className="pr-4 text-right">
                      <span className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label={`Edit ${crop.names.en}`}
                          onClick={() => setEditing(crop)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!editable}
                          aria-label={`Delete ${crop.names.en}`}
                          onClick={() => setDeleting(crop)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {adding ? (
        <CropDialog districts={districts} open onOpenChange={() => setAdding(false)} />
      ) : null}

      {editing ? (
        <CropDialog
          key={editing.id}
          crop={editing}
          districts={districts}
          open
          onOpenChange={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteDialog
          collection="produce"
          id={deleting.id}
          name={deleting.names.en}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Locations
   ------------------------------------------------------------------------- */

export function LocationsPanel({
  geo,
  policy,
  editable,
}: {
  geo: Geography;
  policy: PlatformPolicy;
  editable: boolean;
}) {
  const [openState, setOpenState] = useState<string | null>(
    geo.states.find((s) => s.active)?.id ?? null,
  );

  const [stateDialog, setStateDialog] = useState<{ state?: State } | null>(null);
  const [districtDialog, setDistrictDialog] = useState<{
    district?: District;
    stateId: string;
  } | null>(null);
  const [placeDialog, setPlaceDialog] = useState<{
    place?: Place;
    districtId: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    collection: "states" | "districts" | "places";
    id: string;
    name: string;
  } | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Locations</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            States, the districts within them, and the villages within those.
            Every address field and location filter reads from here. Produce is
            collected at the farm, so the village is the finest thing worth
            naming — there is no depot.
          </p>
        </div>
        <Button disabled={!editable} onClick={() => setStateDialog({})}>
          <PlusIcon className="size-4" />
          Add state
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {geo.states.map((state) => {
          const districts = geo.districts.filter((d) => d.stateId === state.id);
          const expanded = openState === state.id;

          return (
            <li key={state.id} className="bg-card overflow-hidden rounded-lg border">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenState(expanded ? null : state.id)}
                  aria-expanded={expanded}
                  className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <ChevronRightIcon
                    className={cn(
                      "text-faint size-4 shrink-0 transition-transform",
                      expanded && "rotate-90",
                    )}
                  />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="font-medium">{state.name}</span>
                    <span className="text-faint text-xs">
                      {state.nativeName} · {districts.length} districts · vehicles{" "}
                      {state.vehiclePrefix}
                    </span>
                  </span>
                </button>

                <ActivePill active={state.active} on="Live" off="Not launched" />

                <span className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!editable}
                    aria-label={`Add a district to ${state.name}`}
                    onClick={() => setDistrictDialog({ stateId: state.id })}
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!editable}
                    aria-label={`Edit ${state.name}`}
                    onClick={() => setStateDialog({ state })}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!editable}
                    aria-label={`Delete ${state.name}`}
                    onClick={() =>
                      setDeleting({ collection: "states", id: state.id, name: state.name })
                    }
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </span>
              </div>

              {expanded ? (
                <div className="overflow-x-auto border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-40">District</TableHead>
                        <TableHead className="min-w-72">Villages</TableHead>
                        <TableHead className="text-right">Farmers</TableHead>
                        <TableHead className="text-right">Pinned</TableHead>
                        <TableHead className="text-right">Min order</TableHead>
                        <TableHead className="min-w-28">Status</TableHead>
                        <TableHead className="w-0" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {districts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-20 text-center">
                            <span className="text-muted-foreground text-sm">
                              No districts yet.
                            </span>
                          </TableCell>
                        </TableRow>
                      ) : (
                        districts.map((district) => {
                          const places = geo.places.filter(
                            (p) => p.districtId === district.id,
                          );
                          const summary = districtSummary(geo, district.id);
                          // Freight is quoted per buyer from these pins, so an
                          // unpinned village is one no order can be priced for.
                          const pinned = places.filter(isPoint).length;

                          return (
                            <TableRow key={district.id}>
                              <TableCell>
                                <span className="flex flex-col leading-tight">
                                  <span className="font-medium">{district.name}</span>
                                  <span className="text-faint text-xs">
                                    {district.nativeName}
                                  </span>
                                </span>
                              </TableCell>

                              <TableCell>
                                {places.length === 0 ? (
                                  <span className="text-warning text-xs">
                                    No villages — nothing can be listed here
                                  </span>
                                ) : (
                                  <span className="flex flex-wrap gap-1">
                                    {places.map((p) => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        disabled={!editable}
                                        onClick={() =>
                                          setPlaceDialog({
                                            place: p,
                                            districtId: district.id,
                                          })
                                        }
                                        className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                                      >
                                        <Badge
                                          variant="secondary"
                                          className={cn(
                                            "gap-1",
                                            editable && "hover:bg-accent",
                                            !p.active && "opacity-50",
                                          )}
                                        >
                                          <MapPinIcon className="size-3" />
                                          {p.name}
                                          <span className="text-faint">
                                            {p.pincode}
                                          </span>
                                        </Badge>
                                      </button>
                                    ))}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="tabular text-right">
                                {summary.farmers}
                                {summary.farmers > 0 &&
                                summary.farmers < policy.thinSupplyFarmers ? (
                                  <span className="text-warning ml-2 text-xs">thin</span>
                                ) : null}
                              </TableCell>

                              <TableCell className="tabular text-right">
                                {places.length === 0 ? (
                                  "—"
                                ) : pinned === places.length ? (
                                  <span className="text-success">
                                    {pinned}/{places.length}
                                  </span>
                                ) : (
                                  <span className="text-warning">
                                    {pinned}/{places.length}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="tabular text-right">
                                {district.minOrderValue ? (
                                  formatMoney(money(district.minOrderValue))
                                ) : (
                                  <span className="text-faint text-xs">default</span>
                                )}
                              </TableCell>

                              <TableCell>
                                <ActivePill
                                  active={district.active}
                                  on="Active"
                                  off="Inactive"
                                />
                              </TableCell>

                              <TableCell className="pr-4 text-right">
                                <span className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={!editable}
                                    aria-label={`Add a village to ${district.name}`}
                                    onClick={() =>
                                      setPlaceDialog({ districtId: district.id })
                                    }
                                  >
                                    <PlusIcon className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={!editable}
                                    aria-label={`Edit ${district.name}`}
                                    onClick={() =>
                                      setDistrictDialog({
                                        district,
                                        stateId: state.id,
                                      })
                                    }
                                  >
                                    <PencilIcon className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={!editable}
                                    aria-label={`Delete ${district.name}`}
                                    onClick={() =>
                                      setDeleting({
                                        collection: "districts",
                                        id: district.id,
                                        name: district.name,
                                      })
                                    }
                                  >
                                    <TrashIcon className="size-4" />
                                  </Button>
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {stateDialog ? (
        <StateDialog
          key={stateDialog.state?.id ?? "new"}
          state={stateDialog.state}
          open
          onOpenChange={() => setStateDialog(null)}
        />
      ) : null}

      {districtDialog ? (
        <DistrictDialog
          key={districtDialog.district?.id ?? "new"}
          district={districtDialog.district}
          stateId={districtDialog.stateId}
          open
          onOpenChange={() => setDistrictDialog(null)}
        />
      ) : null}

      {placeDialog ? (
        <PlaceDialog
          key={placeDialog.place?.id ?? "new"}
          place={placeDialog.place}
          districtId={placeDialog.districtId}
          open
          onOpenChange={() => setPlaceDialog(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteDialog
          collection={deleting.collection}
          id={deleting.id}
          name={deleting.name}
          open
          onOpenChange={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------
   Fixed vocabulary
   ------------------------------------------------------------------------- */

/**
 * Vocabulary compiled into the domain.
 *
 * Shown so operations can see what the dropdowns will contain, and marked
 * read-only so nobody expects to change it here. A grade or a unit is not a
 * list — it is a value the state machine, the money arithmetic and the
 * OpenAPI contract are all written against.
 *
 * English only. The console is an operator tool, and pairing each unit with
 * its Tamil name — but not its Telugu, Kannada, Malayalam or Hindi one —
 * singled out one of six languages for no reason. Farmer-facing screens
 * translate; this one does not pretend to.
 */
export function FixedVocabulary() {
  const groups = [
    {
      title: "Grades",
      note: "Priced on every offer and recorded at pickup. Adding a fourth grade changes the offer contract.",
      items: GRADES.map((g) => `Grade ${GRADE_LABELS[g]}`),
    },
    {
      title: "Quantity units",
      note: "Money is per unit, so a new unit changes how every rate is interpreted.",
      items: Object.values(QUANTITY_UNITS).map((u) => u.en),
    },
    {
      title: "Vehicle types",
      note: "Reefer is not a label — only a reefer may carry stock inside 24 hours of shelf life.",
      items: Object.values(VEHICLE_TYPE_LABELS),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Fixed vocabulary</h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          These populate dropdowns too, but they are compiled into the domain
          rather than stored as records. Changing one is a code change with
          tests behind it — shown here so you can see what the pickers contain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className="bg-card flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{group.title}</h3>
              <Badge variant="secondary">Read only</Badge>
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <li key={item} className="text-muted-foreground text-sm">
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-faint mt-auto text-xs">{group.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
