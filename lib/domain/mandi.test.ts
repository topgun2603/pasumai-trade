import { describe, expect, it } from "vitest";

import {
  AGMARKNET_NAMES,
  comparableUnit,
  cropForCommodity,
  daysOld,
  isStale,
  perUnit,
  readArrivalDate,
  readQuote,
  arrivalDateParam,
  tickerQuotes,
  type MandiQuote,
} from "./mandi";
import { CATALOGUE } from "@/lib/mock/catalogue";

const NOW = Date.UTC(2026, 7, 23);

describe("quintals into what we trade in", () => {
  /*
    The whole reason this file exists. Agmarknet quotes per quintal and every
    listing here is per kilo, so an unconverted import is a hundred times too
    high — and plausible at a glance, which is how the rounded-away paise
    survived for months.
  */
  it("turns rupees a quintal into paise a kilo", () => {
    // ₹2,400/quintal is ₹24/kg is 2400 paise.
    expect(perUnit(2400, "kg")).toEqual({ minorUnits: 2400, currency: "INR" });
  });

  it("keeps the paise that fall out of the division", () => {
    // ₹2,450/quintal is ₹24.50/kg, not ₹25 — two per cent on every kilo.
    expect(perUnit(2450, "kg")?.minorUnits).toBe(2450);
    expect(perUnit(2455, "kg")?.minorUnits).toBe(2455);
  });

  it("leaves a per-quintal rate alone", () => {
    expect(perUnit(2400, "quintal")?.minorUnits).toBe(240_000);
  });

  it("scales a tonne up by ten", () => {
    expect(perUnit(2400, "tonne")?.minorUnits).toBe(2_400_000);
  });

  it("refuses a crate and a bag rather than guessing", () => {
    /*
      A crate is not a weight — how many kilos are in one depends on the crop,
      the packer and the district, and the platform does not record it. No
      mandi reference is fine; an invented one is not.
    */
    expect(perUnit(2400, "crate")).toBeNull();
    expect(perUnit(2400, "bag")).toBeNull();
    expect(comparableUnit("crate")).toBe(false);
    expect(comparableUnit("kg")).toBe(true);
  });

  it("refuses nonsense instead of returning NaN", () => {
    expect(perUnit(Number.NaN, "kg")).toBeNull();
    expect(perUnit(-100, "kg")).toBeNull();
  });
});

describe("their commodity names against ours", () => {
  it("matches the plain ones", () => {
    expect(cropForCommodity("Tomato")).toBe("tomato");
    expect(cropForCommodity("Onion")).toBe("onion");
  });

  it("ignores case and stray spacing, because staff type these", () => {
    expect(cropForCommodity("  tomato ")).toBe("tomato");
    expect(cropForCommodity("GREEN CHILLI")).toBe("chilli");
  });

  it("takes the alternate names one crop trades under", () => {
    expect(cropForCommodity("Dry Chillies")).toBe("chilli");
    expect(cropForCommodity("Banana - Green")).toBe("banana");
  });

  it("returns nothing for a crop we do not carry", () => {
    // Dropped, not guessed at. A wrong crop on a ticker is worse than a gap.
    expect(cropForCommodity("Arecanut(Betelnut/Supari)")).toBeUndefined();
    expect(cropForCommodity("")).toBeUndefined();
  });

  it("has a mapping for every crop in the catalogue", () => {
    /*
      The reminder. A crop added to the catalogue with no Agmarknet name would
      simply never show a mandi rate, silently, and nobody would connect the
      two — so this fails at the moment the crop is added rather than months
      later when somebody asks why turmeric has no reference price.
    */
    for (const id of Object.keys(CATALOGUE)) {
      expect(AGMARKNET_NAMES[id], `${id} has no Agmarknet name`).toBeDefined();
      expect(AGMARKNET_NAMES[id].length).toBeGreaterThan(0);
    }
  });
});

describe("their date format", () => {
  it("reads DD/MM/YYYY the way they mean it", () => {
    /*
      Parsed by hand rather than by `new Date()`, which reads 03/08/2026 as the
      third of August in some runtimes and the eighth of March in others. A
      rate labelled with the wrong month is worse than one labelled with none.
    */
    const date = readArrivalDate("03/08/2026");
    expect(date?.getUTCDate()).toBe(3);
    expect(date?.getUTCMonth()).toBe(7);
    expect(date?.getUTCFullYear()).toBe(2026);
  });

  it("refuses a day that does not exist", () => {
    // `Date.UTC` rolls 31/02 forward into March rather than failing.
    expect(readArrivalDate("31/02/2026")).toBeNull();
  });

  it("refuses anything that is not their format", () => {
    for (const bad of ["2026-08-03", "3/8/2026", "", "today", null, 42]) {
      expect(readArrivalDate(bad)).toBeNull();
    }
  });
});

describe("reading one record", () => {
  /*
    Field names exactly as the endpoint returns them — capitalised, with
    underscores. Copied from a live response rather than from the docs, which
    describe the filter parameters in a different case from the record keys.
  */
  const RAW = {
    State: "Tamil Nadu",
    District: "Erode",
    Market: "Erode",
    Commodity: "Tomato",
    Arrival_Date: "22/08/2026",
    Min_Price: "2000",
    Max_Price: "2800",
    Modal_Price: "2400",
  };

  it("converts and keeps the market it came from", () => {
    const quote = readQuote(RAW, "kg");
    expect(quote).not.toBeNull();
    expect(quote?.cropId).toBe("tomato");
    expect(quote?.modal).toBe(2400);
    expect(quote?.low).toBe(2000);
    expect(quote?.high).toBe(2800);
    expect(quote?.market).toBe("Erode");
  });

  it("drops a commodity we do not carry", () => {
    expect(readQuote({ ...RAW, Commodity: "Arecanut" }, "kg")).toBeNull();
  });

  it("drops a row where nothing actually traded", () => {
    // The row exists; the price is zero. That is not a price.
    expect(readQuote({ ...RAW, Modal_Price: "0" }, "kg")).toBeNull();
  });

  it("drops a row with an unreadable date", () => {
    expect(readQuote({ ...RAW, Arrival_Date: "" }, "kg")).toBeNull();
  });

  it("drops a row for a unit that cannot be compared", () => {
    expect(readQuote(RAW, "crate")).toBeNull();
  });

  it("takes a price that is not a whole rupee", () => {
    // Real rows carry decimals — "Modal_Price": "21536.62" is one of theirs.
    const quote = readQuote({ ...RAW, Modal_Price: "2450.62" }, "kg");
    expect(quote?.modal).toBe(2451);
  });

  it("ignores a field in the wrong case rather than half-reading a row", () => {
    // The docs name the *filters* in one case and the records come back in
    // another; a row keyed the other way is not a row we can read.
    expect(readQuote({ commodity: "Tomato" } as never, "kg")).toBeNull();
  });
});

describe("what the ticker shows", () => {
  function quote(over: Partial<MandiQuote>): MandiQuote {
    return {
      cropId: "tomato",
      commodity: "Tomato",
      market: "Erode",
      district: "Erode",
      state: "Tamil Nadu",
      low: 2000,
      high: 2800,
      modal: 2400,
      unit: "kg",
      asOf: new Date(NOW - 86_400_000),
      ...over,
    };
  }

  it("keeps the freshest quote per crop", () => {
    // A ticker repeating tomato from four markets is one nobody reads to the
    // end of.
    const rows = tickerQuotes(
      [
        quote({ market: "Erode", asOf: new Date(NOW - 3 * 86_400_000) }),
        quote({ market: "Salem", asOf: new Date(NOW - 86_400_000) }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].market).toBe("Salem");
  });

  it("drops anything gone stale", () => {
    const rows = tickerQuotes([quote({ asOf: new Date(NOW - 9 * 86_400_000) })], NOW);
    expect(rows).toEqual([]);
  });

  it("keeps a rate from within the window", () => {
    expect(isStale(quote({ asOf: new Date(NOW - 4 * 86_400_000) }), NOW)).toBe(false);
    expect(isStale(quote({ asOf: new Date(NOW - 5 * 86_400_000) }), NOW)).toBe(true);
  });

  it("counts whole days old", () => {
    expect(daysOld(quote({ asOf: new Date(NOW - 2 * 86_400_000) }), NOW)).toBe(2);
    expect(daysOld(quote({ asOf: new Date(NOW) }), NOW)).toBe(0);
  });

  it("orders steadily, so the ticker does not reshuffle each load", () => {
    const rows = tickerQuotes(
      [quote({ cropId: "onion" }), quote({ cropId: "banana" }), quote({ cropId: "tomato" })],
      NOW,
    );
    expect(rows.map((r) => r.cropId)).toEqual(["banana", "onion", "tomato"]);
  });

  it("has nothing to say when every market is silent", () => {
    expect(tickerQuotes([], NOW)).toEqual([]);
  });
});

describe("their date, as a filter value", () => {
  it("round-trips through the format they expect", () => {
    /*
      The archive holds eighty-one million rows returned oldest first, so a
      fetch without a date filter reads 2023. Getting this string right is what
      makes the ticker "live" rather than three years old.
    */
    const date = new Date(Date.UTC(2026, 7, 3));
    expect(arrivalDateParam(date)).toBe("03/08/2026");
    expect(readArrivalDate(arrivalDateParam(date))?.getTime()).toBe(date.getTime());
  });

  it("pads both the day and the month", () => {
    expect(arrivalDateParam(new Date(Date.UTC(2026, 0, 9)))).toBe("09/01/2026");
  });
});
