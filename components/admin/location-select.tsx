"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  districtsIn,
  findDistrict,
  findPlace,
  findState,
  placesIn,
  type Geography,
} from "@/lib/domain/location";

export interface LocationValue {
  readonly stateId: string;
  readonly districtId: string;
  readonly placeId: string;
}

export const EMPTY_LOCATION: LocationValue = {
  stateId: "",
  districtId: "",
  placeId: "",
};

/**
 * State → district → place, as three dependent selects.
 *
 * Cascading rather than three independent dropdowns, because the alternative
 * lets someone file a Kerala village under a Tamil Nadu district and nothing
 * catches it. Changing a level clears the levels below it — leaving a stale
 * district selected under a new state is the exact bug this shape prevents.
 *
 * Only active rows are offered: a state the platform has not launched in is
 * registered in Controls but must not be selectable on a form.
 *
 * Choosing a place also fills the PIN code, since the place record already
 * knows it — one less field to mistype.
 */
export function LocationSelect({
  geo,
  value,
  onChange,
  errors,
  disabled,
}: {
  geo: Geography;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  errors?: Partial<Record<keyof LocationValue, string>>;
  disabled?: boolean;
}) {
  const states = geo.states.filter((s) => s.active);
  const districts = value.stateId ? districtsIn(geo, value.stateId) : [];
  const places = value.districtId ? placesIn(geo, value.districtId) : [];

  const stateName = findState(geo, value.stateId)?.name;
  const districtName = findDistrict(geo, value.districtId)?.name;
  const place = findPlace(geo, value.placeId);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loc-state" className="text-sm">
          State
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </Label>
        <Select
          value={value.stateId}
          disabled={disabled}
          onValueChange={(stateId) =>
            // Clear the levels below — a district from the previous state is
            // not valid under this one.
            onChange({ stateId, districtId: "", placeId: "" })
          }
        >
          <SelectTrigger id="loc-state" aria-invalid={Boolean(errors?.stateId)}>
            <SelectValue placeholder="Select state">{stateName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span>{s.name}</span>
                  <span className="text-faint text-xs">{s.nativeName}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.stateId ? (
          <p className="text-destructive text-xs">{errors.stateId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loc-district" className="text-sm">
          District
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </Label>
        <Select
          value={value.districtId}
          disabled={disabled || !value.stateId}
          onValueChange={(districtId) =>
            onChange({ ...value, districtId, placeId: "" })
          }
        >
          <SelectTrigger
            id="loc-district"
            aria-invalid={Boolean(errors?.districtId)}
          >
            <SelectValue
              placeholder={value.stateId ? "Select district" : "Select a state first"}
            >
              {districtName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.districtId ? (
          <p className="text-destructive text-xs">{errors.districtId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loc-place" className="text-sm">
          Village or town
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </Label>
        <Select
          value={value.placeId}
          disabled={disabled || !value.districtId}
          onValueChange={(placeId) => onChange({ ...value, placeId })}
        >
          <SelectTrigger id="loc-place" aria-invalid={Boolean(errors?.placeId)}>
            <SelectValue
              placeholder={
                value.districtId ? "Select village or town" : "Select a district first"
              }
            >
              {place?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {places.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span>{p.name}</span>
                  <span className="text-faint text-xs">
                    {p.pincode}
                    {p.lat && p.lng ? null : " · not pinned"}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.placeId ? (
          <p className="text-destructive text-xs">{errors.placeId}</p>
        ) : (
          <p className="text-faint text-xs">
            {/* The PIN comes from the place record rather than being typed. */}
            {place ? `PIN ${place.pincode}` : "PIN code is filled from the village"}
          </p>
        )}
      </div>
    </>
  );
}
