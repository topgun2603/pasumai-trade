import { describe, expect, it } from "vitest";

import {
  AD_SLOTS,
  adState,
  eligible,
  findSlot,
  isLive,
  isSafeHref,
  pick,
  placeAd,
  rotationFor,
  ROTATION_MS,
  slotsOn,
  validateAd,
  type Ad,
} from "./ad";

const AT = new Date("2026-06-01T10:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function ad(over: Partial<Ad> = {}): Ad {
  return {
    id: "ad-1",
    name: "Seed co-op, June",
    advertiser: "Kaveri Seeds",
    slotId: "landing.banner",
    creative: { headline: "Certified seed, delivered" },
    locales: [],
    roles: [],
    weight: 1,
    active: true,
    createdAt: new Date(AT - 30 * DAY),
    ...over,
  };
}

describe("whether an ad is running", () => {
  it("runs with no dates at all", () => {
    expect(isLive(ad(), AT)).toBe(true);
  });

  it("is off when switched off, whatever the dates say", () => {
    const booked = ad({ active: false, startsAt: new Date(AT - DAY), endsAt: new Date(AT + DAY) });
    expect(isLive(booked, AT)).toBe(false);
    expect(adState(booked, AT)).toBe("paused");
  });

  it("starts on its start and not before", () => {
    const booked = ad({ startsAt: new Date(AT) });
    expect(isLive(booked, AT - 1)).toBe(false);
    expect(isLive(booked, AT)).toBe(true);
    expect(adState(booked, AT - 1)).toBe("scheduled");
  });

  it("does not run on the day it ends", () => {
    // "Until the 1st" means the 1st is not included — the reading the person
    // who booked it has, and the one an invoice is written against.
    const booked = ad({ endsAt: new Date(AT) });
    expect(isLive(booked, AT - 1)).toBe(true);
    expect(isLive(booked, AT)).toBe(false);
    expect(adState(booked, AT)).toBe("ended");
  });
});

describe("who is eligible for a slot", () => {
  it("keeps to its own slot", () => {
    const ads = [ad({ id: "a" }), ad({ id: "b", slotId: "farm.home" })];
    expect(eligible(ads, { slotId: "landing.banner", at: AT }).map((a) => a.id)).toEqual(["a"]);
  });

  it("treats an empty target list as no restriction", () => {
    // The important case: a landing-page reader has no role and no chosen
    // locale, and an untargeted ad must still reach them.
    expect(eligible([ad()], { slotId: "landing.banner", at: AT })).toHaveLength(1);
  });

  it("honours a locale target", () => {
    const tamil = ad({ locales: ["ta"] });
    expect(eligible([tamil], { slotId: "landing.banner", at: AT, locale: "ta" })).toHaveLength(1);
    expect(eligible([tamil], { slotId: "landing.banner", at: AT, locale: "en" })).toHaveLength(0);
    // Targeted at Tamil, reader's locale unknown: not shown. Guessing would
    // put Tamil copy in front of a Hindi reader.
    expect(eligible([tamil], { slotId: "landing.banner", at: AT })).toHaveLength(0);
  });

  it("honours a role target", () => {
    const forFarmers = ad({ slotId: "farm.home", roles: ["farmer"] });
    expect(eligible([forFarmers], { slotId: "farm.home", at: AT, role: "farmer" })).toHaveLength(1);
    expect(eligible([forFarmers], { slotId: "farm.home", at: AT, role: "buyer" })).toHaveLength(0);
  });

  it("orders by age so two servers agree", () => {
    const older = ad({ id: "older", createdAt: new Date(AT - 10 * DAY) });
    const newer = ad({ id: "newer", createdAt: new Date(AT - DAY) });
    expect(eligible([newer, older], { slotId: "landing.banner", at: AT }).map((a) => a.id)).toEqual([
      "older",
      "newer",
    ]);
  });
});

describe("picking one of them", () => {
  it("gives nothing when nothing is eligible", () => {
    expect(pick([], 0)).toBeNull();
  });

  it("is stable for the same rotation", () => {
    const ads = [ad({ id: "a" }), ad({ id: "b" }), ad({ id: "c" })];
    expect(pick(ads, 7)?.id).toBe(pick(ads, 7)?.id);
  });

  it("splits a slot in proportion to weight", () => {
    // One at 1 and one at 3: over four consecutive rotations the second
    // should take three of them.
    const ads = [ad({ id: "small", weight: 1 }), ad({ id: "large", weight: 3 })];
    const taken = [0, 1, 2, 3].map((r) => pick(ads, r)!.id);
    expect(taken.filter((id) => id === "small")).toHaveLength(1);
    expect(taken.filter((id) => id === "large")).toHaveLength(3);
  });

  it("stays inside the list for a negative rotation", () => {
    const ads = [ad({ id: "a" }), ad({ id: "b" })];
    expect(pick(ads, -1)).not.toBeNull();
    expect(pick(ads, -97)).not.toBeNull();
  });

  it("treats a nonsense weight as the minimum rather than breaking the split", () => {
    const ads = [ad({ id: "broken", weight: Number.NaN }), ad({ id: "fine", weight: 1 })];
    expect(pick(ads, 0)!.id).toBe("broken");
    expect(pick(ads, 1)!.id).toBe("fine");
  });
});

describe("rotation", () => {
  it("holds still within one window and moves to the next", () => {
    expect(rotationFor(AT)).toBe(rotationFor(AT + ROTATION_MS - 1));
    expect(rotationFor(AT + ROTATION_MS)).not.toBe(rotationFor(AT));
  });
});

describe("placing an ad end to end", () => {
  it("returns nothing for an empty slot rather than throwing", () => {
    expect(placeAd([], { slotId: "landing.banner", at: AT })).toBeNull();
  });

  it("skips an ended campaign and shows the one still running", () => {
    const ads = [
      ad({ id: "over", endsAt: new Date(AT - DAY) }),
      ad({ id: "running", createdAt: new Date(AT - DAY) }),
    ];
    expect(placeAd(ads, { slotId: "landing.banner", at: AT })?.id).toBe("running");
  });
});

describe("links an ad may point at", () => {
  it("takes https and a path on this site", () => {
    expect(isSafeHref("https://kaveriseeds.example/june")).toBe(true);
    expect(isSafeHref("/en/signin")).toBe(true);
  });

  it("refuses script and data urls", () => {
    // The whole reason this function exists: a paid placement is somebody
    // else's text, and both of these turn it into script on our origin.
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("refuses a protocol-relative url wearing a leading slash", () => {
    expect(isSafeHref("//evil.example/june")).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("   ")).toBe(false);
  });

  /*
    Every one of these is a real keystroke on the way to a valid address, and
    the ad editor previews the placement live — so `Clickable` in
    components/ads/ad-slot.tsx asks this function before it builds a <Link>.
    `https:` is the one that cost something: truthy, so a bare `if (!href)`
    let it through, and not convertible to a URL, so next/link threw building
    the prefetch and took the editor down on a keystroke.
  */
  it("refuses an address that is still being typed", () => {
    expect(isSafeHref("h")).toBe(false);
    expect(isSafeHref("https")).toBe(false);
    expect(isSafeHref("https:")).toBe(false);
    expect(isSafeHref("https:/")).toBe(false);
    expect(isSafeHref("https://")).toBe(false);
  });
});

describe("what operations may save", () => {
  const good = {
    name: "Kaveri June",
    advertiser: "Kaveri Seeds",
    slotId: "landing.banner",
    headline: "Certified seed, delivered",
    weight: 3,
  };

  it("accepts the minimum", () => {
    expect(validateAd(good)).toEqual({ ok: true, errors: [] });
  });

  it("reports every problem at once", () => {
    const result = validateAd({ slotId: "nope", weight: 99 });
    expect(result.ok).toBe(false);
    // Name, advertiser, slot, headline, weight — five, in one pass, so the
    // form is corrected once rather than five times.
    expect(result.errors).toHaveLength(5);
  });

  it("insists a section placement carries an image", () => {
    const result = validateAd({ ...good, slotId: "landing.afterPrices" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("image"))).toBe(true);
  });

  it("insists an image is described", () => {
    const result = validateAd({ ...good, imagePath: "ads/x/y.jpg" });
    expect(result.errors.some((e) => e.includes("Describe"))).toBe(true);
  });

  it("refuses a button that goes nowhere", () => {
    const result = validateAd({ ...good, ctaLabel: "Shop now" });
    expect(result.errors.some((e) => e.includes("no link"))).toBe(true);
  });

  it("refuses an end before a start", () => {
    const result = validateAd({
      ...good,
      startsAt: "2026-06-10T00:00:00Z",
      endsAt: "2026-06-01T00:00:00Z",
    });
    expect(result.errors.some((e) => e.includes("end before it starts"))).toBe(true);
  });
});

describe("the slot registry", () => {
  it("has no duplicate ids", () => {
    expect(new Set(AD_SLOTS.map((s) => s.id)).size).toBe(AD_SLOTS.length);
  });

  it("finds a slot by id and misses a made-up one", () => {
    expect(findSlot("landing.banner")?.format).toBe("banner");
    expect(findSlot("landing-banner")).toBeUndefined();
  });

  it("groups by surface", () => {
    expect(slotsOn("landing").every((s) => s.surface === "landing")).toBe(true);
    expect(slotsOn("landing").length).toBeGreaterThan(0);
  });
});
