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
 * ## The provider, and the boundary question
 *
 * Boundary depiction is a legal question in this country rather than a styling
 * one — Survey of India requires a particular treatment of J&K, Ladakh and
 * Arunachal that not every basemap follows.
 *
 * Google's answer is the `region` parameter: it "alters your application to
 * serve different map tiles", and their localisation guide puts the duty
 * squarely on us — *"it is also your responsibility to ensure that your
 * application complies with local laws by ensuring that the correct region
 * localization is applied"*. So `region=IN` is not optional decoration here.
 * It is the line that makes this map lawful to show, and it is why the loader
 * below refuses to build a URL without it.
 *
 * This was written against Mappls first, whose maps are compliant by default;
 * that provider was reachable but the console was not, from the machine that
 * mattered. Google needs a billing account where Mappls does not, and the
 * boundary duty moves from the provider to us — both worth knowing if it is
 * ever revisited.
 *
 * ## Why it loads late, and sometimes not at all
 *
 * The script is fetched only when the section is scrolled towards. This sits
 * two thirds of the way down the landing page — the one route on this platform
 * that has to open quickly on a village connection — so somebody who never
 * reaches it never pays for it. That is also what keeps this inside Google's
 * free allowance: a map load is only billed when a map is actually built, and
 * most visitors never scroll this far.
 *
 * The village cards underneath are not a fallback bolted on afterwards: they
 * are the content, and they render from the server with no JavaScript at all.
 * The map illustrates them. With no key, a blocked script, or a provider that
 * does not answer, the section is still complete and still says where produce
 * is collected.
 */

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Only what this component calls. */
interface LatLngLiteral {
  lat: number;
  lng: number;
}

interface GoogleBounds {
  extend: (point: LatLngLiteral) => void;
}

interface GoogleMap {
  fitBounds: (bounds: GoogleBounds, padding?: number) => void;
}

interface GoogleMarker {
  setMap: (map: GoogleMap | null) => void;
  addListener: (event: string, handler: () => void) => void;
}

interface GoogleInfoWindow {
  setContent: (content: string) => void;
  open: (options: { anchor: GoogleMarker; map: GoogleMap }) => void;
  close: () => void;
}

interface GoogleMaps {
  Map: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleMarker;
  InfoWindow: new (options?: Record<string, unknown>) => GoogleInfoWindow;
  LatLngBounds: new () => GoogleBounds;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
  }
}

const SCRIPT_ID = "google-maps-js";

/** Loads the API once, however many components ask for it. */
function loadMaps(language: string): Promise<GoogleMaps> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google.maps);

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    if (!existing) {
      const url = new URL("https://maps.googleapis.com/maps/api/js");
      url.searchParams.set("key", KEY ?? "");
      // Not optional. See the note at the top of this file: this is the
      // parameter that decides which country's borders are drawn.
      url.searchParams.set("region", "IN");
      url.searchParams.set("language", language);
      url.searchParams.set("loading", "async");

      script.id = SCRIPT_ID;
      script.async = true;
      script.src = url.toString();
      document.head.appendChild(script);
    }

    script.addEventListener("load", () =>
      window.google?.maps
        ? resolve(window.google.maps)
        : reject(new Error("maps script loaded without google.maps")),
    );
    script.addEventListener("error", () => reject(new Error("maps script failed")));
  });
}

export function CoverageMap({
  places,
  opening,
  language,
  labels,
}: {
  places: MappedPlace[];
  /**
   * States configured but not opened.
   *
   * Listed under the map rather than marked on it. A pin here means produce is
   * collected there, and putting the same mark on a state nobody has signed up
   * in would be the map telling a lie more convincingly than a sentence could.
   */
  opening: OpeningState[];
  /** The reader's locale, so Google labels the map in their own script. */
  language: string;
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
    if (!element || !KEY) return;

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
    if (!near || !KEY) return;
    const element = container.current;
    if (!element) return;

    let cancelled = false;
    let markers: GoogleMarker[] = [];

    async function draw() {
      try {
        const maps = await loadMaps(language);
        if (cancelled || !element) return;

        const pins = groupNearby(places);
        const box = boundsOf(pins);

        const map = new maps.Map(element, {
          center: box
            ? { lat: (box.north + box.south) / 2, lng: (box.east + box.west) / 2 }
            : // The middle of the country, for a map with nothing to show.
              { lat: 22.5, lng: 80 },
          zoom: box ? 6 : 4,
          // A marketing illustration, not a tool. Street View and map-type
          // switching are controls for somebody navigating, and this reader is
          // not.
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });

        const info = new maps.InfoWindow();

        for (const pin of pins) {
          const farmers = pin.places.reduce((n, p) => n + p.farmerCount, 0);
          const names = pin.places.map((p) => p.name).join(", ");

          /*
            The classic marker rather than AdvancedMarkerElement. The advanced
            one needs a Map ID configured in the Cloud console — a second piece
            of setup, in a second place, for a marketing map that draws twelve
            plain dots. It is marked legacy and is not going away without
            notice; when this needs custom marker HTML, that is the moment to
            take on the Map ID.
          */
          const marker = new maps.Marker({
            map,
            position: { lat: pin.lat, lng: pin.lng },
            title: names,
          });

          marker.addListener("click", () => {
            info.setContent(
              `<strong>${escapeHtml(names)}</strong><br>${farmers} ${escapeHtml(labels.farmers)}`,
            );
            info.open({ anchor: marker, map });
          });

          markers.push(marker);
        }

        // Tightened onto the pins, rather than trusting the guessed zoom.
        if (box) {
          const bounds = new maps.LatLngBounds();
          bounds.extend({ lat: box.south, lng: box.west });
          bounds.extend({ lat: box.north, lng: box.east });
          map.fitBounds(bounds, 48);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void draw();

    return () => {
      cancelled = true;
      // Google has no `map.remove()`. Detaching the markers is what releases
      // them; the map itself goes when React drops the container.
      for (const marker of markers) marker.setMap(null);
      markers = [];
    };
  }, [near, places, language, labels]);

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

  // With no key there is no map and nothing to apologise for: the cards below
  // are the section. A grey rectangle that never fills would be worse.
  if (!KEY) return chips;

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

/** Village names go into the info window as markup, so they are escaped here. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
