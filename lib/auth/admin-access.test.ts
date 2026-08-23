import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { franchiseMayRead } from "./admin-access";
import { mayAccess } from "./claims";

const ADMIN_ROOT = join(process.cwd(), "app", "(console)", "(admin)");

/**
 * Every page under the admin console, as the URL it answers on.
 *
 * Route groups — the bracketed folders — are structure and not path, so they
 * are dropped. What is left is what somebody can type.
 */
function routes(dir: string, prefix = ""): { url: string; operations: boolean }[] {
  const found: { url: string; operations: boolean }[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      // `(operations)` is the gate; other groups are only organisation.
      const segment = entry.startsWith("(") ? "" : `/${entry}`;
      found.push(...routes(path, prefix + segment));
      continue;
    }

    if (entry === "page.tsx") {
      found.push({
        url: prefix || "/",
        operations: dir.includes(`(operations)`),
      });
    }
  }

  return found;
}

describe("the admin console's two audiences", () => {
  const all = routes(ADMIN_ROOT);

  it("finds the routes at all", () => {
    // Guards the walker itself. If the tree moves and this returns nothing,
    // every assertion below passes vacuously and the check is worthless.
    expect(all.length).toBeGreaterThan(12);
    expect(all.map((r) => r.url)).toContain("/admin/controls");
    expect(all.map((r) => r.url)).toContain("/admin/buyers");
  });

  /*
    The point of the whole file.

    A page is either open to a franchise or it lives under `(operations)`.
    Anything in neither is a page somebody added without deciding who may read
    it, and the failure names it rather than leaving it to be discovered by a
    partner opening it.
  */
  it("classifies every page as open to a franchise or operations-only", () => {
    const unclassified = all.filter(
      (route) => !route.operations && !franchiseMayRead(route.url),
    );

    expect(
      unclassified.map((r) => r.url),
      "add these to FRANCHISE_ADMIN_PATHS, or move them under (operations)",
    ).toEqual([]);
  });

  it("keeps the four closed sections closed", () => {
    for (const url of [
      "/admin/controls",
      "/admin/subscriptions",
      "/admin/franchises",
      "/admin/kyc",
      "/admin/consoles/farmers",
      "/admin/consoles/farmers/F-1",
    ]) {
      expect(franchiseMayRead(url), url).toBe(false);
      expect(mayAccess("franchise", url), url).toBe(false);
    }
  });

  it("does not let a closed section hide under an open prefix", () => {
    // `/admin/transport` is open as a prefix. A page named to look like it
    // sits under it must not inherit that.
    expect(franchiseMayRead("/admin/transportation-secrets")).toBe(false);
    expect(franchiseMayRead("/admin/controls/rates")).toBe(false);
  });

  it("opens the overview exactly, never as a prefix", () => {
    /*
      `/admin` is in the list, and a naive `startsWith` would make that one
      entry open the entire console — Controls included. This is the assertion
      that would catch it.
    */
    expect(franchiseMayRead("/admin")).toBe(true);
    expect(franchiseMayRead("/admin/controls")).toBe(false);
  });

  it("gives a buyer none of it", () => {
    // A franchise and a buyer share the buying console, and this is where the
    // two part company.
    expect(mayAccess("buyer", "/admin")).toBe(false);
    expect(mayAccess("buyer", "/admin/farmers")).toBe(false);
    expect(mayAccess("franchise", "/admin/farmers")).toBe(true);
  });

  it("leaves the buying console open to a franchise", () => {
    expect(mayAccess("franchise", "/listings")).toBe(true);
    expect(mayAccess("franchise", "/franchise/dispatch")).toBe(true);
  });

  it("still gives operations everything", () => {
    for (const route of all) {
      expect(mayAccess("admin", route.url), route.url).toBe(true);
    }
  });
});
