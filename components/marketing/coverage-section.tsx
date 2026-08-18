"use client";

import { ChevronDownIcon, FlaskConicalIcon, MapPinIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { CoverageMap } from "@/components/marketing/coverage-map";
import type { MappedPlace, OpeningState } from "@/lib/domain/coverage-map";
import { cn } from "@/lib/utils";

/**
 * Where we collect: a map, and the villages behind it.
 *
 * The two used to sit one above the other and say the same thing twice — a pin
 * on Bhavani and, a scroll later, a card reading Bhavani. Once the map is
 * genuinely drawn the cards fold away behind a disclosure.
 *
 * Folded, not removed. The cards carry two things the pins do not: the pincode,
 * and a form somebody can read without a canvas. Deleting them would take the
 * section's only textual content away from a screen reader and hand it a map
 * instead, which is not a trade worth making to avoid a duplicate. They are
 * also all that is left when the map cannot draw — no key, no billing, a
 * blocked script — so the fold is driven by the map actually reporting success,
 * never by the presence of a key.
 */

export interface CoveragePlaceCard {
  readonly id: string;
  readonly name: string;
  readonly districtName: string;
  readonly pincode: string;
  readonly farmerCount: number;
}

export function CoverageSection({
  cards,
  pins,
  opening,
  live,
  language,
  labels,
}: {
  cards: CoveragePlaceCard[];
  pins: MappedPlace[];
  opening: OpeningState[];
  /** False when these are the seeded villages rather than the platform's own. */
  live: boolean;
  language: string;
  labels: {
    farmers: string;
    openingSoon: string;
    unavailable: string;
    regionLabel: string;
    illustrative: string;
    showList: string;
    hideList: string;
  };
}) {
  const [mapped, setMapped] = useState(false);
  const [open, setOpen] = useState(false);

  // Stable, or the map's effect would tear down and rebuild on every render of
  // this component — which on a marketing page means a fresh billed map load.
  const onLoaded = useCallback(() => setMapped(true), []);

  const list = (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((place) => (
        <li
          key={place.id}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-5",
            live
              ? "bg-card"
              : // Drawn as an example, not merely labelled as one.
                "border-dashed",
          )}
        >
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-3.5 shrink-0" />
            {place.districtName}
          </span>
          <h3 className="leading-snug font-medium">{place.name}</h3>
          <p className="text-faint tabular text-sm">
            {place.farmerCount} {labels.farmers} · {place.pincode}
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {live ? null : (
        <p className="border-border bg-secondary text-muted-foreground mt-1 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs">
          <FlaskConicalIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{labels.illustrative}</span>
        </p>
      )}

      <CoverageMap
        places={pins}
        opening={opening}
        language={language}
        labels={labels}
        onLoaded={onLoaded}
      />

      {mapped ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
          >
            <ChevronDownIcon
              className={cn("size-4 transition-transform", open ? "" : "-rotate-90")}
            />
            {open ? labels.hideList : labels.showList}
          </button>
          {open ? <div className="mt-4">{list}</div> : null}
        </div>
      ) : (
        <div className="mt-8">{list}</div>
      )}
    </>
  );
}
