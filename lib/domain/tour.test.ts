import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ROLES, type Role } from "@/lib/auth/claims";
import { TOURS, tourFor } from "./tour";

/**
 * A tour step points at a rail item by href, and a step whose href is not on
 * screen is dropped silently at runtime — deliberately, so a link removed next
 * month does not leave an arrow aimed at a corner. The price of that kindness
 * is that a step written against a link this role never had also disappears
 * without complaint, and the tour is quietly shorter than intended.
 *
 * Not hypothetical: the first manpower tour explained "work on offer" and
 * pointed at `/agency/pickups`, which is a *transport* link. It vanished on
 * every run and nothing said so.
 *
 * ## Why this reads the rails as source text
 *
 * Checking that the href merely appears somewhere would not have caught that —
 * `/agency/pickups` is right there in the agency rail, gated. What matters is
 * whether **this role** can see it, and the gates live in the rail files: the
 * agency rail marks links `service: "transport" | "manpower"`, and the buying
 * rail keeps a separate franchise-only list.
 *
 * The rails are client components full of icon imports, so importing them here
 * would drag JSX and lucide into a node test to assert one string each. Parsing
 * is the lesser evil — and `parses the gates it depends on` below fails loudly
 * if the shape of those files ever moves, rather than letting this file quietly
 * assert nothing.
 */

function railSource(file: string): string {
  return readFileSync(join(process.cwd(), "components", file), "utf8");
}

/**
 * The named array literal from a rail file, as text.
 *
 * Ends at the closing bracket at column zero, whatever follows it — a rail may
 * close with `];` or with `] satisfies ReadonlyArray<…>;`, and the farm rail
 * changed from one to the other the day its labels became dictionary keys. What
 * matters is the entries, not how the array declares its type.
 */
function arrayBlock(source: string, name: string): string {
  const start = source.indexOf(`const ${name}`);
  if (start === -1) throw new Error(`${name} is no longer declared where this test expects it`);
  const end = source.indexOf("\n]", start);
  if (end === -1) throw new Error(`${name} does not end where this test expects it`);
  return source.slice(start, end);
}

function hrefsIn(block: string): string[] {
  return [...block.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
}

/**
 * The account page, which is on the rail without being in its link list.
 *
 * Profile moved out of every rail's `LINKS` and into the account block at the
 * foot of it — one place for it, beside the address it describes, and on a
 * phone it was costing the bottom bar one of five slots. It is still a link,
 * still on the rail and still carries `data-tour`, so a step aimed at it is
 * still shown. This test would not know that from the link list alone, and
 * would have concluded three tours were pointing at nothing.
 */
function profileHrefIn(source: string): string[] {
  const match = /profile=\{\{ href: "([^"]+)"/.exec(source);
  return match ? [match[1]] : [];
}

/** href → the agency service that gates it, or null when every agency sees it. */
function agencyGates(): Map<string, string | null> {
  const block = arrayBlock(railSource("agency/agency-nav.tsx"), "LINKS");
  const gates = new Map<string, string | null>();

  // Each entry runs from its href to the next one, so a `service` found in that
  // window belongs to it.
  const entries = [...block.matchAll(/href: "([^"]+)"/g)];
  for (const [at, match] of entries.entries()) {
    const from = match.index!;
    const to = entries[at + 1]?.index ?? block.length;
    const service = /service: "(\w+)"/.exec(block.slice(from, to));
    gates.set(match[1], service ? service[1] : null);
  }

  return gates;
}

function visibleTo(role: Role): Set<string> {
  const buying = railSource("franchise/console-nav.tsx");

  if (role === "farmer") {
    const farm = railSource("farm/farm-nav.tsx");
    // The farm rail has no gating: everything on it belongs to the farmer.
    return new Set([
      ...hrefsIn(arrayBlock(farm, "LINKS")),
      ...[...farm.matchAll(/href="(\/farm[^"]*)"/g)].map((m) => m[1]),
      ...profileHrefIn(farm),
    ]);
  }

  if (role === "buyer") {
    return new Set([
      ...hrefsIn(arrayBlock(buying, "BUYING_LINKS")),
      ...profileHrefIn(buying),
    ]);
  }

  if (role === "franchise") {
    return new Set([
      ...hrefsIn(arrayBlock(buying, "BUYING_LINKS")),
      ...hrefsIn(arrayBlock(buying, "FRANCHISE_LINKS")),
      ...profileHrefIn(buying),
    ]);
  }

  const gates = agencyGates();
  return new Set([
    ...[...gates]
      .filter(([, service]) => service === null || service === role)
      .map(([href]) => href),
    // Ungated: every agency has one, whatever service they supply.
    ...profileHrefIn(railSource("agency/agency-nav.tsx")),
  ]);
}

describe("console tours", () => {
  it("parses the gates it depends on", () => {
    const gates = agencyGates();
    // If these two stop holding, the reachability test below has stopped
    // testing anything and this is the assertion that says so.
    expect(gates.get("/agency/pickups")).toBe("transport");
    expect(gates.get("/agency/workers")).toBe("manpower");
    // Ungated: every agency is notified, whatever service they supply.
    // Profile used to be the example here and is no longer a rail link at all —
    // see `profileHrefIn`. Verification was the example before that, and has
    // moved underneath Profile.
    expect(gates.get("/agency/notifications")).toBeNull();
  });

  it("gives every role but operations a tour", () => {
    for (const role of ROLES) {
      if (role === "admin") {
        expect(tourFor(role)).toBeNull();
      } else {
        expect(tourFor(role), `${role} has no tour`).not.toBeNull();
      }
    }
  });

  it("points every step at a link that role can actually see", () => {
    for (const role of ROLES) {
      const tour = tourFor(role);
      if (!tour) continue;

      const reachable = visibleTo(role);
      for (const step of tour.steps) {
        expect(
          reachable.has(step.target),
          `${role}: ${step.target} is not on their rail, so this step would never be shown`,
        ).toBe(true);
      }
    }
  });

  it("keeps tour ids distinct, so one console cannot dismiss another", () => {
    const ids = Object.values(TOURS).map((tour) => tour!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never repeats a target inside one tour", () => {
    for (const [role, tour] of Object.entries(TOURS)) {
      const targets = tour!.steps.map((step) => step.target);
      expect(new Set(targets).size, `${role} points twice at the same link`).toBe(targets.length);
    }
  });

  it("keeps every step short enough to read standing up", () => {
    for (const [role, tour] of Object.entries(TOURS)) {
      for (const step of tour!.steps) {
        expect(step.title.length, `${role}: "${step.title}" is a paragraph`).toBeLessThan(34);
        expect(step.body.length, `${role}: "${step.title}" runs long`).toBeLessThan(165);
      }
    }
  });
});
