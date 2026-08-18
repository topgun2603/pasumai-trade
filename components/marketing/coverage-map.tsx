"use client";

import { useEffect, useRef, useState } from "react";

import {
  boundsOf,
  groupNearby,
  type MappedPlace,
  type OpeningState,
} from "@/lib/domain/coverage-map";

/**
 * The coverage, on a map of India.
 *
 * ## Why it loads late, and sometimes not at all
 *
 * MapLibre is about a quarter of a megabyte before a single tile is fetched.
 * This sits two thirds of the way down the landing page — the one route on this
 * platform that has to open quickly on a village connection — so it is
 * imported only when the section is actually scrolled towards. Somebody who
 * never reaches it never pays for it.
 *
 * The village cards underneath are not a fallback bolted on afterwards: they
 * are the content, and they render from the server with no JavaScript at all.
 * The map is an illustration of them. If the key is missing, the import fails,
 * WebGL is unavailable, or the tiles do not answer, the section is still
 * complete and still says where produce is collected.
 *
 * ## The tiles
 *
 * The style URL comes from the environment rather than being composed here.
 * Mappls issues a style URL with the token already in it, and the exact shape
 * of that URL is theirs to change — pasting it in whole means a provider change
 * is a deployment setting rather than a code change. It also means this
 * component has no opinion about which provider draws India, which matters:
 * boundary depiction is a legal question in this country, not a styling one,
 * and it should be answered by whoever chose the account.
 */

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

/** The whole country, for when there is nothing to fit to. */
const INDIA = { west: 68, south: 6.5, east: 97.5, north: 36 };

export function CoverageMap({
  places,
  opening,
  labels,
}: {
  places: MappedPlace[];
  /** States configured but not yet live. Drawn differently, and said so. */
  opening: OpeningState[];
  labels: {
    farmers: string;
    openingSoon: string;
    unavailable: string;
    regionLabel: string;
  };
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);

  /*
    Arm the loader when the section is a screen away, not when it is on screen.
    A map that begins downloading as it comes into view is a grey box for the
    first second of looking at it.
  */
  useEffect(() => {
    const element = container.current;
    if (!element || !STYLE_URL) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !STYLE_URL) return;
    const element = container.current;
    if (!element) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    async function draw() {
      try {
        // Imported here, not at the top of the file: a static import would put
        // MapLibre in the landing page's bundle whether or not anybody scrolls
        // this far.
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !element) return;

        const pins = groupNearby(places);
        const bounds = boundsOf(pins.length > 0 ? pins : []);

        const instance = new maplibre.Map({
          container: element,
          style: STYLE_URL!,
          // Fitted to the pins where there are any, the country where there are
          // not. A map opened on the whole of India with three pins in one
          // corner tells a reader less than one opened on the corner.
          bounds: bounds
            ? [
                [bounds.west, bounds.south],
                [bounds.east, bounds.north],
              ]
            : [
                [INDIA.west, INDIA.south],
                [INDIA.east, INDIA.north],
              ],
          fitBoundsOptions: { padding: 48 },
          // A marketing illustration, not a tool. Dragging it around is fine;
          // spinning it into a pitched 3D view is a way to end up looking at
          // the horizon by accident.
          pitchWithRotate: false,
          dragRotate: false,
          attributionControl: { compact: true },
        });

        map = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        instance.on("error", () => setFailed(true));

        for (const pin of pins) {
          const el = document.createElement("div");
          el.className =
            "flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#1c5b3e] text-[10px] font-semibold text-white shadow";
          el.textContent = pin.places.length > 1 ? String(pin.places.length) : "";

          const farmers = pin.places.reduce((n, p) => n + p.farmerCount, 0);
          const title = pin.places.map((p) => p.name).join(", ");

          new maplibre.Marker({ element: el })
            .setLngLat([pin.lng, pin.lat])
            .setPopup(
              new maplibre.Popup({ offset: 14, closeButton: false }).setText(
                `${title} — ${farmers} ${labels.farmers}`,
              ),
            )
            .addTo(instance);
        }

        /*
          States configured but not opened. Deliberately not a pin: a pin on
          this map means "produce is collected here", and putting the same mark
          on a state nobody has signed up in would be the map telling a lie
          more convincingly than a sentence could.
        */
        for (const state of opening) {
          const el = document.createElement("div");
          el.className =
            "rounded-full border border-dashed border-[#1c5b3e]/60 bg-white/85 px-2 py-0.5 text-[10px] whitespace-nowrap text-[#1c5b3e]";
          el.textContent = `${state.name} · ${labels.openingSoon}`;
          new maplibre.Marker({ element: el })
            .setLngLat([state.lng, state.lat])
            .addTo(instance);
        }
      } catch {
        // No WebGL, a blocked chunk, a style URL that does not answer. The
        // cards below carry the section on their own.
        if (!cancelled) setFailed(true);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [near, places, opening, labels]);

  // Nothing configured and nothing to apologise for: the cards below are the
  // section. Rendering a grey rectangle that never fills would be worse than
  // rendering nothing.
  if (!STYLE_URL) return null;

  if (failed) {
    return (
      <p className="text-faint mt-6 text-xs">{labels.unavailable}</p>
    );
  }

  return (
    <div
      ref={container}
      role="region"
      /*
        Labelled, not hidden. `aria-hidden` was the obvious choice — the
        villages are already on the page in words below — but the zoom buttons
        inside are focusable, and focusable controls inside an aria-hidden
        subtree are a trap: a keyboard user tabs into something a screen reader
        refuses to describe.
      */
      aria-label={labels.regionLabel}
      className="border-border bg-secondary mt-6 h-[22rem] w-full overflow-hidden rounded-xl border sm:h-[28rem]"
    />
  );
}
