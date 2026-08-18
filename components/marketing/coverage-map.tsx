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
 * ## Why Mappls, and why its own SDK
 *
 * Boundary depiction is a legal question in this country rather than a styling
 * one — Survey of India requires a particular treatment of J&K, Ladakh and
 * Arunachal that the open basemaps do not follow. Mappls is Indian-registered
 * and compliant by default, which is why it was chosen.
 *
 * This was first written against MapLibre with a `style.json` URL, on the
 * assumption that Mappls publishes one. **It does not.** Its vector maps ship
 * as a script SDK wrapping its own renderer, with no documented style endpoint
 * to hand to another library. So the SDK is loaded directly, and `maplibre-gl`
 * is gone: a dependency nothing imports is one that only costs.
 *
 * ## Why it loads late, and sometimes not at all
 *
 * The script is fetched only when the section is scrolled towards. This sits
 * two thirds of the way down the landing page — the one route on this platform
 * that has to open quickly on a village connection — so somebody who never
 * reaches it never pays for it.
 *
 * The village cards underneath are not a fallback bolted on afterwards: they
 * are the content, and they render from the server with no JavaScript at all.
 * The map illustrates them. With no token, a blocked script, no WebGL, or a
 * provider that does not answer, the section is still complete and still says
 * where produce is collected.
 */

const TOKEN = process.env.NEXT_PUBLIC_MAPPLS_TOKEN;

/** Only what this component calls. The SDK ships no types. */
interface MapplsMap {
  fitBounds?: (bounds: number[][], options?: { padding?: number }) => void;
  remove?: () => void;
}

interface MapplsSdk {
  Map: new (
    container: HTMLElement | string,
    options: {
      center: { lat: number; lng: number };
      zoom?: number;
      zoomControl?: boolean;
      location?: boolean;
    },
  ) => MapplsMap;
  Marker: new (options: {
    map: MapplsMap;
    position: { lat: number; lng: number };
    popupHtml?: string;
  }) => unknown;
}

declare global {
  interface Window {
    mappls?: MapplsSdk;
  }
}

const SDK_ID = "mappls-web-sdk";

/** Loads the SDK once, however many components ask for it. */
function loadSdk(): Promise<MapplsSdk> {
  return new Promise((resolve, reject) => {
    if (window.mappls) return resolve(window.mappls);

    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    if (!existing) {
      script.id = SDK_ID;
      script.async = true;
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(
        TOKEN ?? "",
      )}`;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () =>
      window.mappls ? resolve(window.mappls) : reject(new Error("sdk loaded without mappls")),
    );
    script.addEventListener("error", () => reject(new Error("sdk failed to load")));
  });
}

export function CoverageMap({
  places,
  opening,
  labels,
}: {
  places: MappedPlace[];
  /**
   * States configured but not opened.
   *
   * Listed under the map rather than marked on it. A pin here means produce is
   * collected there, and the same mark on a state nobody has signed up in would
   * be the map telling a lie more convincingly than a sentence could. The SDK's
   * custom-marker HTML is also not something I could verify without an account,
   * and a chip in ordinary markup is both honester and surer.
   */
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
    Armed when the section is a screen away, not when it is on screen. A map
    that begins downloading as it comes into view is a grey box for the first
    second of looking at it.
  */
  useEffect(() => {
    const element = container.current;
    if (!element || !TOKEN) return;

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
    if (!near || !TOKEN) return;
    const element = container.current;
    if (!element) return;

    let map: MapplsMap | null = null;
    let cancelled = false;

    async function draw() {
      try {
        const mappls = await loadSdk();
        if (cancelled || !element) return;

        const pins = groupNearby(places);
        const bounds = boundsOf(pins);

        // Centred on the pins. Without any, the middle of the country — which
        // is what a map with nothing to show should be looking at.
        const centre = bounds
          ? {
              lat: (bounds.north + bounds.south) / 2,
              lng: (bounds.east + bounds.west) / 2,
            }
          : { lat: 22.5, lng: 80 };

        const instance = new mappls.Map(element, {
          center: centre,
          zoom: bounds ? 6 : 4,
          zoomControl: true,
          location: false,
        });
        map = instance;

        for (const pin of pins) {
          const farmers = pin.places.reduce((n, p) => n + p.farmerCount, 0);
          const names = pin.places.map((p) => p.name).join(", ");
          new mappls.Marker({
            map: instance,
            position: { lat: pin.lat, lng: pin.lng },
            popupHtml: `<strong>${escapeHtml(names)}</strong><br>${farmers} ${escapeHtml(
              labels.farmers,
            )}`,
          });
        }

        // Tightened onto the pins once they are placed. Optional-chained
        // because it is not part of the documented minimum, and a map already
        // centred on the right place is fine without it.
        if (bounds) {
          instance.fitBounds?.(
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.north],
            ],
            { padding: 48 },
          );
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      map?.remove?.();
    };
  }, [near, places, labels]);

  const chips =
    opening.length > 0 ? (
      <ul className="mt-3 flex flex-wrap gap-2">
        {opening.map((state) => (
          <li
            key={state.id}
            className="border-border text-muted-foreground rounded-full border border-dashed px-2.5 py-1 text-xs"
          >
            {state.name}
            <span className="text-faint"> · {labels.openingSoon}</span>
          </li>
        ))}
      </ul>
    ) : null;

  // With no token there is no map and nothing to apologise for: the cards below
  // are the section. A grey rectangle that never fills would be worse.
  if (!TOKEN) return chips;

  return (
    <>
      {failed ? (
        <p className="text-faint mt-6 text-xs">{labels.unavailable}</p>
      ) : (
        <div
          ref={container}
          role="region"
          /*
            Labelled, not hidden. `aria-hidden` was the obvious choice — the
            villages are already on the page in words below — but the zoom
            controls inside are focusable, and focusable controls inside an
            aria-hidden subtree are a trap: a keyboard user tabs into something
            a screen reader refuses to describe.
          */
          aria-label={labels.regionLabel}
          className="border-border bg-secondary mt-6 h-[22rem] w-full overflow-hidden rounded-xl border sm:h-[28rem]"
        />
      )}
      {chips}
    </>
  );
}

/** Village names go into the SDK's popup as markup, so they are escaped here. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
