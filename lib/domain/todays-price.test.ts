import { describe, expect, it } from "vitest";

import {
  median,
  preferLive,
  quotesFrom,
  withinWindow,
  type PriceQuote,
  type SettledSale,
} from "./todays-price";

const NOW = new Date("2026-08-18T12:00:00+05:30").getTime();

function sale(
  produceId: string,
  ratePerUnit: number,
  hoursAgo: number,
  extra: Partial<SettledSale> = {},
): SettledSale {
  return {
    produceId,
    ratePerUnit,
    unit: "kg",
    agreedAt: new Date(NOW - hoursAgo * 3_600_000),
    placeId: "Kodumudi",
    ...extra,
  };
}

function quote(produceId: string, ratePerUnit: number): PriceQuote {
  return {
    produceId,
    ratePerUnit,
    unit: "kg",
    settledCount: 1,
    sources: 1,
    latestAt: new Date(NOW),
  };
}

describe("the middle of what settled", () => {
  it("takes the middle value rather than the average", () => {
    // One distress sale must not drag the figure a farmer is deciding against.
    expect(median([1000, 2000, 2100])).toBe(2000);
  });

  it("splits the difference on an even count", () => {
    expect(median([1000, 2000])).toBe(1500);
  });

  it("has nothing to say about nothing", () => {
    expect(median([])).toBe(0);
  });
});

describe("what counts as today", () => {
  it("keeps a bargain struck last night", () => {
    // A rolling day, not since midnight: at seven in the morning the freshest
    // thing the platform knows is often from yesterday evening.
    expect(withinWindow([sale("tomato", 1400, 13)], NOW)).toHaveLength(1);
  });

  it("drops one from the week before", () => {
    expect(withinWindow([sale("tomato", 1400, 200)], NOW)).toHaveLength(0);
  });

  it("drops a sale stamped in the future", () => {
    // A clock problem, not a price — it would otherwise head every list for as
    // long as the skew lasted.
    expect(withinWindow([sale("tomato", 1400, -5)], NOW)).toHaveLength(0);
  });
});

describe("one figure per crop", () => {
  it("counts the bargains behind the price", () => {
    const quotes = quotesFrom(
      [sale("tomato", 1400, 1), sale("tomato", 1600, 2), sale("tomato", 1500, 3)],
      NOW,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0].ratePerUnit).toBe(1500);
    expect(quotes[0].settledCount).toBe(3);
  });

  it("counts villages, not sellers", () => {
    const quotes = quotesFrom(
      [
        sale("tomato", 1400, 1, { placeId: "Kodumudi" }),
        sale("tomato", 1500, 2, { placeId: "Kodumudi" }),
        sale("tomato", 1600, 3, { placeId: "Bhavani" }),
      ],
      NOW,
    );
    expect(quotes[0].sources).toBe(2);
  });

  it("never averages across units", () => {
    // Tomato by the kilo and tomato by the crate are two different numbers, and
    // a median across both describes neither.
    const quotes = quotesFrom(
      [
        sale("tomato", 1400, 1),
        sale("tomato", 1500, 2),
        sale("tomato", 52_000, 3, { unit: "crate" }),
      ],
      NOW,
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0].unit).toBe("kg");
    expect(quotes[0].ratePerUnit).toBe(1450);
  });

  it("gives every crop its own line", () => {
    const quotes = quotesFrom([sale("tomato", 1400, 1), sale("onion", 118_000, 2)], NOW);
    expect(quotes.map((q) => q.produceId).sort()).toEqual(["onion", "tomato"]);
  });
});

describe("real prices before examples", () => {
  it("never lets a sample displace a real figure", () => {
    const shown = preferLive([quote("tomato", 1400)], [quote("onion", 118_000)], 1);
    expect(shown).toHaveLength(1);
    expect(shown[0].quote.produceId).toBe("tomato");
    expect(shown[0].illustrative).toBe(false);
  });

  it("never shows a crop twice, once real and once as an example", () => {
    const shown = preferLive([quote("tomato", 1400)], [quote("tomato", 1900)], 5);
    expect(shown).toHaveLength(1);
    expect(shown[0].quote.ratePerUnit).toBe(1400);
  });

  it("fills the rest of the section with examples, marked", () => {
    const shown = preferLive(
      [quote("tomato", 1400)],
      [quote("onion", 118_000), quote("mango", 86_000)],
      3,
    );
    expect(shown.map((s) => s.illustrative)).toEqual([false, true, true]);
  });

  it("marks every line when nothing has settled", () => {
    const shown = preferLive([], [quote("onion", 118_000)], 9);
    expect(shown.every((s) => s.illustrative)).toBe(true);
  });

  it("stops at the target rather than listing the whole catalogue", () => {
    const template = Array.from({ length: 20 }, (_, i) => quote(`crop-${i}`, 1000 + i));
    expect(preferLive([], template, 9)).toHaveLength(9);
  });
});
