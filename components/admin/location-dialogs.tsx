"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useControls } from "@/components/admin/use-controls";
import type { EditableCollection } from "@/lib/domain/controls";
import {
  formatPoint,
  isInIndia,
  parseCoordinates,
} from "@/lib/domain/distance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { District, Place, State } from "@/lib/domain/location";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";

function Field({
  label,
  htmlFor,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2 flex flex-col gap-1.5" : "flex flex-col gap-1.5"}>
      <Label htmlFor={htmlFor} className="text-sm">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-faint text-xs font-normal">optional</span>
        )}
      </Label>
      {children}
      {hint ? <p className="text-faint text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * Active toggles rather than delete buttons, wherever a record is referenced.
 *
 * Deactivating removes something from every dropdown without breaking the
 * listings, orders and addresses that already point at it. Delete exists too,
 * but the API refuses when anything depends on the record — so this is the
 * control that actually gets used.
 */
function ActiveSwitch({
  id,
  active,
  onChange,
  label,
}: {
  id: string;
  active: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="border-border sm:col-span-2 flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
      <div className="flex flex-col">
        <Label htmlFor={id} className="text-sm">
          Active
        </Label>
        <span className="text-faint text-xs">{label}</span>
      </div>
      <Switch id={id} checked={active} onCheckedChange={onChange} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   State
   ------------------------------------------------------------------------- */

export function StateDialog({
  state,
  open,
  onOpenChange,
}: {
  state?: State;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [name, setName] = useState(state?.name ?? "");
  const [nativeName, setNativeName] = useState(state?.nativeName ?? "");
  const [locale, setLocale] = useState(state?.locale ?? "en");
  const [vehiclePrefix, setVehiclePrefix] = useState(state?.vehiclePrefix ?? "");
  const [active, setActive] = useState(state?.active ?? false);

  async function save() {
    const body = { name, nativeName, locale, vehiclePrefix, active };
    const ok = state
      ? await update("states", state.id, body)
      : await create("states", body);
    if (ok) {
      toast.success(state ? `${name} updated` : `${name} added`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{state ? `Edit ${state.name}` : "Add a state"}</DialogTitle>
          <DialogDescription>
            A state holds districts, which hold villages. Only active states
            appear in address pickers.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="state-name" required>
              <Input
                id="state-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tamil Nadu"
              />
            </Field>

            <Field label="Native name" htmlFor="state-native">
              <Input
                id="state-native"
                value={nativeName}
                onChange={(e) => setNativeName(e.target.value)}
                placeholder="தமிழ்நாடு"
              />
            </Field>

            <Field
              label="Primary language"
              htmlFor="state-locale"
              hint="Defaults a farmer's app language when they register here"
            >
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="state-locale">
                  <SelectValue>
                    {LOCALE_META[locale as keyof typeof LOCALE_META]?.nativeName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LOCALE_META[l].nativeName} · {LOCALE_META[l].englishName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Vehicle prefix"
              htmlFor="state-prefix"
              required
              hint="Two letters, e.g. TN — validates registration numbers"
            >
              <Input
                id="state-prefix"
                value={vehiclePrefix}
                onChange={(e) => setVehiclePrefix(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="TN"
                className="font-mono"
              />
            </Field>

            <ActiveSwitch
              id="state-active"
              active={active}
              onChange={setActive}
              label="Inactive states are hidden from every address picker"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : state ? "Save changes" : "Add state"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   District
   ------------------------------------------------------------------------- */

export function DistrictDialog({
  district,
  stateId,
  open,
  onOpenChange,
}: {
  district?: District;
  stateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [name, setName] = useState(district?.name ?? "");
  const [nativeName, setNativeName] = useState(district?.nativeName ?? "");
  // Held in paise, edited in rupees.
  const [minOrder, setMinOrder] = useState(
    district?.minOrderValue ? String(district.minOrderValue / 100) : "",
  );
  const [active, setActive] = useState(district?.active ?? true);

  async function save() {
    const body = {
      stateId: district?.stateId ?? stateId,
      name,
      nativeName,
      minOrderValue: minOrder.trim() === "" ? "" : Math.round(Number(minOrder) * 100),
      active,
    };
    const ok = district
      ? await update("districts", district.id, body)
      : await create("districts", body);
    if (ok) {
      toast.success(district ? `${name} updated` : `${name} added`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {district ? `Edit ${district.name}` : "Add a district"}
          </DialogTitle>
          <DialogDescription>
            Districts scope what a buyer may source and route each vehicle run.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="district-name" required>
              <Input
                id="district-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Krishnagiri"
              />
            </Field>

            <Field label="Native name" htmlFor="district-native">
              <Input
                id="district-native"
                value={nativeName}
                onChange={(e) => setNativeName(e.target.value)}
                placeholder="கிருஷ்ணகிரி"
              />
            </Field>

            <Field
              label="Minimum order"
              htmlFor="district-min"
              hint="Rupees. A distant district needs a bigger load to be worth the run. Blank uses the platform default."
              wide
            >
              <div className="flex items-center gap-2">
                <span className="text-faint">₹</span>
                <Input
                  id="district-min"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  inputMode="decimal"
                  placeholder="15000"
                  className="tabular max-w-40"
                />
              </div>
            </Field>

            <ActiveSwitch
              id="district-active"
              active={active}
              onChange={setActive}
              label="Existing listings and orders keep working when inactive"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : district ? "Save changes" : "Add district"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Place
   ------------------------------------------------------------------------- */

export function PlaceDialog({
  place,
  districtId,
  open,
  onOpenChange,
}: {
  place?: Place;
  districtId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { create, update, pending } = useControls();
  const [name, setName] = useState(place?.name ?? "");
  const [nativeName, setNativeName] = useState(place?.nativeName ?? "");
  const [pincode, setPincode] = useState(place?.pincode ?? "");
  // One field, not two. Nobody types latitude and longitude — they paste them
  // out of Google Maps, and forcing the pair apart is where a transposed digit
  // puts a village in the sea.
  const [coordinates, setCoordinates] = useState(
    place?.lat && place?.lng ? `${place.lat}, ${place.lng}` : "",
  );
  const [farmerCount, setFarmerCount] = useState(String(place?.farmerCount ?? "0"));
  const [active, setActive] = useState(place?.active ?? true);

  const point = parseCoordinates(coordinates);
  const coordinatesTyped = coordinates.trim().length > 0;
  const swapped = point !== null && !isInIndia(point);

  async function save() {
    if (coordinatesTyped && !point) {
      toast.error("Could not read those coordinates", {
        description: "Paste a Google Maps link, or a pair like 12.7409, 77.8253.",
      });
      return;
    }
    if (swapped) {
      toast.error("That pin is not in India", {
        description:
          "Latitude and longitude are probably the wrong way round. Check before saving — freight is quoted off this.",
      });
      return;
    }

    const body = {
      districtId: place?.districtId ?? districtId,
      name,
      nativeName,
      pincode,
      lat: point ? point.lat : "",
      lng: point ? point.lng : "",
      farmerCount: Number(farmerCount),
      active,
    };
    const ok = place
      ? await update("places", place.id, body)
      : await create("places", body);
    if (ok) {
      toast.success(place ? `${name} updated` : `${name} added`);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {place ? `Edit ${place.name}` : "Add a village or town"}
          </DialogTitle>
          <DialogDescription>
            The finest location the platform addresses — where the vehicle
            actually stops, because produce is collected at the farm.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="place-name" required>
              <Input
                id="place-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kaveripattinam"
              />
            </Field>

            <Field label="Native name" htmlFor="place-native">
              <Input
                id="place-native"
                value={nativeName}
                onChange={(e) => setNativeName(e.target.value)}
                placeholder="காவேரிப்பட்டினம்"
              />
            </Field>

            <Field
              label="PIN code"
              htmlFor="place-pin"
              required
              hint="Fills the PIN automatically on every address form"
            >
              <Input
                id="place-pin"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="635112"
                className="font-mono"
              />
            </Field>

            <Field
              label="Location"
              htmlFor="place-coordinates"
              wide
              hint="Right-click the village in Google Maps, copy the coordinates, and paste them here. A Maps link works too. Freight and arrival estimates are measured from this to each buyer — there is no single distance to store, because it depends on who is buying."
            >
              <Input
                id="place-coordinates"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
                placeholder="12.7409, 77.8253"
                className="font-mono"
                aria-invalid={coordinatesTyped && (!point || swapped)}
              />
              {coordinatesTyped && !point ? (
                <p className="text-destructive text-xs">
                  Could not find a coordinate pair in that. Paste a Maps link or
                  a pair like 12.7409, 77.8253.
                </p>
              ) : swapped ? (
                <p className="text-destructive text-xs">
                  That pin is outside India — latitude and longitude are almost
                  certainly the wrong way round.
                </p>
              ) : point ? (
                <p className="text-success text-xs">
                  Pinned at {formatPoint(point)}.{" "}
                  <a
                    href={`https://www.google.com/maps/?q=${point.lat},${point.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Check it on a map
                  </a>
                </p>
              ) : (
                <p className="text-warning text-xs">
                  Not pinned. Nothing here can be quoted for freight until it is.
                </p>
              )}
            </Field>

            <Field
              label="Farmers registered"
              htmlFor="place-farmers"
              required
              hint="A thin pool is flagged as a supply risk"
            >
              <Input
                id="place-farmers"
                value={farmerCount}
                onChange={(e) => setFarmerCount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>

            <ActiveSwitch
              id="place-active"
              active={active}
              onChange={setActive}
              label="Inactive places cannot be chosen on new registrations"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : place ? "Save changes" : "Add place"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   Delete
   ------------------------------------------------------------------------- */

export function DeleteDialog({
  collection,
  id,
  name,
  open,
  onOpenChange,
}: {
  collection: EditableCollection;
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { remove, pending } = useControls();

  async function confirm() {
    const ok = await remove(collection, id);
    if (ok) {
      toast.success(`${name} deleted`);
      onOpenChange(false);
    }
    // A refusal keeps the dialog open — the toast explains what still
    // references the record, and closing would hide the reason.
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This cannot be undone. If anything still references it — a listing,
            a village, a stock line — the delete is refused and you will be told
            what is in the way. Deactivating is usually what you want: it hides
            the record from every dropdown without breaking existing data.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
