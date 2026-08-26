import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AD_SLOTS } from "./ad";

/**
 * The slot list and the pages have to agree.
 *
 * A slot in {@link AD_SLOTS} that no page renders is space operations can sell
 * and a reader will never see: the admin screen offers it, a campaign is
 * booked into it, the money is taken, and nothing appears. Nothing throws,
 * because nothing is wrong — the ad is simply somewhere no `<AdSlot>` asks
 * for it.
 *
 * That failure is invisible from inside the app, so it is caught from outside
 * it. This walks the source for `slotId="…"` and compares the two lists.
 *
 * It reads the filesystem, which a domain test normally has no business doing.
 * The alternative is a registry the pages import and register into at runtime,
 * which is more machinery in production code to answer a question that only
 * matters at build time.
 */

const ROOTS = ["app", "components"];
const EXTENSIONS = [".tsx", ".ts"];

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, found);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(path);
  }
  return found;
}

/** `slotId="landing.banner"` as written in JSX, not as computed. */
const RENDERED = new Set<string>();
for (const root of ROOTS) {
  for (const file of sources(root)) {
    // The component's own definition names the prop without a value to match.
    if (file.endsWith(join("ads", "ad-slot.tsx"))) continue;
    for (const match of readFileSync(file, "utf8").matchAll(/slotId="([^"]+)"/g)) {
      RENDERED.add(match[1]);
    }
  }
}

describe("every slot that can be sold is a slot that is drawn", () => {
  it.each(AD_SLOTS.map((slot) => [slot.id, slot.label]))(
    "%s (%s) is rendered somewhere",
    (id) => {
      expect(RENDERED.has(id as string)).toBe(true);
    },
  );

  it("renders no slot that is not on the list", () => {
    // The other direction: a page asking for `landing.mid` when the list says
    // `landing.afterPrices` renders nothing, silently, forever.
    const known = new Set(AD_SLOTS.map((slot) => slot.id));
    expect([...RENDERED].filter((id) => !known.has(id))).toEqual([]);
  });
});
