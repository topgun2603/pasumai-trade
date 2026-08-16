import { describe, expect, it } from "vitest";

import {
  DEPENDENTS,
  isDeletable,
  isEditable,
  slugify,
  validate,
} from "./controls";
import { activeProduce, type Produce } from "./models";
import { DEFAULT_POLICY } from "./policy";

/**
 * The controls validators are the only thing standing between a browser and
 * Firestore writes made with Admin credentials, which bypass every Security
 * Rule. So the tests care about two things: what gets rejected, and what
 * document id a create lands on — because ids here are referenced by listings,
 * orders and addresses, and a changed convention silently orphans them.
 */

const CROP = {
  names: { en: "Green Chilli", ta: "பச்சை மிளகாய்" },
  emoji: "🌶️",
  defaultUnit: "kg",
};

describe("isEditable", () => {
  it("allows only the four reference collections", () => {
    expect(isEditable("produce")).toBe(true);
    expect(isEditable("places")).toBe(true);
    expect(isEditable("buyers")).toBe(false);
    expect(isEditable("orders")).toBe(false);
  });
});

describe("slugify", () => {
  it("makes a readable, stable id", () => {
    expect(slugify("Green Chilli")).toBe("green-chilli");
    expect(slugify("  Lady's Finger  ")).toBe("lady-s-finger");
  });

  it("drops non-Latin script rather than emitting an unusable id", () => {
    // Tamil names live in `names.ta`; the id stays ASCII so it can appear in a
    // URL and be read out over the phone.
    expect(slugify("தக்காளி Tomato")).toBe("tomato");
  });
});

describe("validate produce", () => {
  it("requires an English name", () => {
    const result = validate("produce", { ...CROP, names: { ta: "தக்காளி" } });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("English");
  });

  it("requires an emoji or an icon", () => {
    const result = validate("produce", { ...CROP, emoji: "" });
    expect(result.ok).toBe(false);
  });

  it("accepts an icon in place of an emoji", () => {
    const result = validate("produce", {
      ...CROP,
      emoji: "",
      iconUrl: "data:image/webp;base64,UklGRg==",
    });
    expect(result.ok).toBe(true);
    expect(result.data?.iconUrl).toBe("data:image/webp;base64,UklGRg==");
  });

  it("refuses an icon that is not an image data URI", () => {
    const result = validate("produce", {
      ...CROP,
      iconUrl: "https://example.com/chilli.png",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a photograph sent to the icon field", () => {
    const result = validate("produce", {
      ...CROP,
      iconUrl: `data:image/jpeg;base64,${"A".repeat(100_000)}`,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown unit", () => {
    expect(validate("produce", { ...CROP, defaultUnit: "truckload" }).ok).toBe(
      false,
    );
  });

  it("keeps only the six known languages", () => {
    const result = validate("produce", {
      ...CROP,
      names: { ...CROP.names, fr: "Piment", "": "junk" },
    });
    expect(Object.keys(result.data?.names as object).sort()).toEqual(["en", "ta"]);
  });

  it("drops a regional override with no name in it", () => {
    const result = validate("produce", {
      ...CROP,
      regional: { Thanjavur: { ta: "  " }, Erode: { ta: "மொளகா" } },
    });
    expect(result.data?.regional).toEqual({ Erode: { ta: "மொளகா" } });
  });

  it("ignores fields it was not asked to store", () => {
    const result = validate("produce", { ...CROP, verified: true, price: 999 });
    expect(result.data).not.toHaveProperty("verified");
    expect(result.data).not.toHaveProperty("price");
  });

  it("derives the id from the English name", () => {
    expect(validate("produce", CROP).id).toBe("green-chilli");
  });

  it("is active unless retired explicitly", () => {
    expect(validate("produce", CROP).data?.active).toBe(true);
    expect(validate("produce", { ...CROP, active: false }).data?.active).toBe(false);
  });
});

describe("activeProduce", () => {
  it("hides retired crops but keeps ones that predate the field", () => {
    const catalogue = [
      { ...CROP, id: "a", active: true },
      { ...CROP, id: "b", active: false },
      { ...CROP, id: "c" },
    ] as unknown as Produce[];

    expect(activeProduce(catalogue).map((p) => p.id)).toEqual(["a", "c"]);
  });
});

describe("validate states", () => {
  it("requires a two-letter vehicle prefix", () => {
    expect(validate("states", { name: "Kerala", vehiclePrefix: "" }).ok).toBe(false);
    expect(validate("states", { name: "Kerala", vehiclePrefix: "KER" }).ok).toBe(
      false,
    );
  });

  it("uses the vehicle prefix as the document id", () => {
    // Not `slugify(name)` — place ids are built as `<state>-<place>`, and
    // `tamil-nadu` would make those unparseable.
    const result = validate("states", {
      name: "Tamil Nadu",
      vehiclePrefix: "tn",
    });
    expect(result.id).toBe("tn");
    expect(result.data?.vehiclePrefix).toBe("TN");
  });

  it("falls back to the English name when no native name is given", () => {
    const result = validate("states", { name: "Goa", vehiclePrefix: "GA" });
    expect(result.data?.nativeName).toBe("Goa");
  });
});

describe("validate districts", () => {
  it("must belong to a state", () => {
    expect(validate("districts", { name: "Salem" }).ok).toBe(false);
  });

  it("namespaces the id under its state", () => {
    const result = validate("districts", { stateId: "tn", name: "Krishnagiri" });
    expect(result.id).toBe("tn-krishnagiri");
  });
});

describe("validate places", () => {
  const PLACE = {
    districtId: "tn-krishnagiri",
    name: "Kaveripattinam",
    pincode: "635112",
    lat: 12.4204,
    lng: 78.2166,
    farmerCount: 41,
  };

  it("accepts a well-formed village", () => {
    const result = validate("places", PLACE);
    expect(result.ok).toBe(true);
    expect(result.id).toBe("tn-kaveripattinam");
    expect(result.data?.lat).toBe(12.4204);
    expect(result.data?.lng).toBe(78.2166);
  });

  it("rejects a PIN code that is not six digits starting 1-9", () => {
    expect(validate("places", { ...PLACE, pincode: "035112" }).ok).toBe(false);
    expect(validate("places", { ...PLACE, pincode: "63511" }).ok).toBe(false);
  });

  it("allows a village with no pin yet", () => {
    // A village can be registered before anyone has stood in it with a phone.
    const result = validate("places", { ...PLACE, lat: "", lng: "" });
    expect(result.ok).toBe(true);
    expect(result.data?.lat).toBeNull();
    expect(result.data?.lng).toBeNull();
  });

  it("refuses half a coordinate", () => {
    // One without the other is not a location, and storing it would make a
    // village look pinned to anything checking only one field.
    expect(validate("places", { ...PLACE, lng: "" }).ok).toBe(false);
    expect(validate("places", { ...PLACE, lat: "" }).ok).toBe(false);
  });

  it("refuses coordinates outside India", () => {
    // The failure that actually happens is a transposed pair: Kaveripattinam's
    // numbers swapped land it off Somalia, and every freight estimate from
    // there would be confidently four thousand kilometres wrong.
    const result = validate("places", { ...PLACE, lat: 78.2166, lng: 12.4204 });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("swapped");
  });

  it("refuses an out-of-range latitude or longitude", () => {
    expect(validate("places", { ...PLACE, lat: 112 }).ok).toBe(false);
    expect(validate("places", { ...PLACE, lng: 277 }).ok).toBe(false);
  });

  it("rounds farmer count to a whole number", () => {
    expect(validate("places", { ...PLACE, farmerCount: 41.2 }).data?.farmerCount).toBe(41);
  });

  it("stores a missing native name as null, never undefined", () => {
    // Firestore rejects `undefined` outright, and a write that throws at the
    // driver is a save button that fails for no visible reason.
    const result = validate("places", { ...PLACE, nativeName: "" });
    expect(result.data?.nativeName).toBeNull();
  });
});

describe("validate packs", () => {
  const PACK = { unit: "kg", container: "Crate", packSize: 25 };

  it("derives the label rather than trusting one sent in", () => {
    // A label reading "25 kg crate" over a packSize of 20 is a lie the buyer
    // has no way to catch, and money is priced per pack.
    const result = validate("packs", { ...PACK, label: "50 kg drum" });
    expect(result.data?.label).toBe("25 kg crate");
    expect(result.id).toBe("25-kg-crate");
  });

  it("rejects a pack size of zero or below", () => {
    expect(validate("packs", { ...PACK, packSize: 0 }).ok).toBe(false);
    expect(validate("packs", { ...PACK, packSize: -5 }).ok).toBe(false);
  });

  it("needs a container and a known unit", () => {
    expect(validate("packs", { ...PACK, container: "" }).ok).toBe(false);
    expect(validate("packs", { ...PACK, unit: "truckload" }).ok).toBe(false);
  });
});

describe("validate phrases", () => {
  const PHRASE = {
    kind: "notification",
    event: "priceAgreed",
    channel: "sms",
    audience: "farmer",
    text: { en: "Price agreed", ta: "விலை முடிவானது" },
  };

  it("requires English, because every other language falls back to it", () => {
    const result = validate("phrases", { ...PHRASE, text: { ta: "விலை" } });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("English");
  });

  it("requires an event for a notification but not for a quick reply", () => {
    expect(validate("phrases", { ...PHRASE, event: "" }).ok).toBe(false);
    expect(
      validate("phrases", {
        kind: "quickReply",
        audience: "farmer",
        text: { en: "Picked this morning" },
      }).ok,
    ).toBe(true);
  });

  it("drops the channel on a quick reply — nothing sends it", () => {
    const result = validate("phrases", {
      kind: "quickReply",
      audience: "farmer",
      channel: "sms",
      text: { en: "Ready to load" },
    });
    expect(result.data?.channel).toBeNull();
  });

  it("keeps only the six known languages", () => {
    const result = validate("phrases", {
      ...PHRASE,
      text: { ...PHRASE.text, fr: "Prix convenu" },
    });
    expect(Object.keys(result.data?.text as object).sort()).toEqual(["en", "ta"]);
  });

  it("rejects an unknown channel or audience", () => {
    expect(validate("phrases", { ...PHRASE, channel: "pigeon" }).ok).toBe(false);
    expect(validate("phrases", { ...PHRASE, audience: "regulator" }).ok).toBe(false);
  });
});

/**
 * The bargain vocabulary is the only text that reaches a bargaining screen —
 * that screen has no input box — so this validator is the whole boundary
 * between an operator and what two traders can say to each other.
 */
describe("validate bargain phrases", () => {
  const SAYING = {
    speaker: "buyer",
    topic: "timing",
    text: { en: "We can collect on the weekend.", ta: "வார இறுதியில் எடுக்கலாம்." },
  };

  it("accepts an ordinary phrase and slugs the id from the English", () => {
    const result = validate("bargainPhrases", SAYING);
    expect(result.ok).toBe(true);
    expect(result.id).toBe("we-can-collect-on-the-weekend");
    expect(result.data).toMatchObject({ speaker: "buyer", topic: "timing", active: true });
  });

  it("requires English, because every other language falls back to it", () => {
    const result = validate("bargainPhrases", { ...SAYING, text: { ta: "சரி" } });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("English");
  });

  it("refuses a phone number, which is the whole point of the fixed list", () => {
    const result = validate("bargainPhrases", {
      ...SAYING,
      text: { en: "Call me on 98430 11204 for a better rate." },
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("number");
  });

  it("refuses a number hidden in a translation nobody proof-reads", () => {
    // English clean, Tamil carrying the number. Checking only `en` would ship
    // it to exactly the reader least able to report it.
    const result = validate("bargainPhrases", {
      ...SAYING,
      text: { en: "Call me about the rate.", ta: "என்னை ௯௮௪௩௦ இல் அழைக்கவும்." },
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("TA");
  });

  it("refuses an unknown speaker or topic", () => {
    expect(validate("bargainPhrases", { ...SAYING, speaker: "broker" }).ok).toBe(false);
    expect(validate("bargainPhrases", { ...SAYING, topic: "weather" }).ok).toBe(false);
  });

  it("keeps only the six known languages", () => {
    const result = validate("bargainPhrases", {
      ...SAYING,
      text: { ...SAYING.text, fr: "Nous pouvons collecter." },
    });
    expect(Object.keys(result.data?.text as object).sort()).toEqual(["en", "ta"]);
  });

  it("can be switched off rather than deleted", () => {
    const result = validate("bargainPhrases", { ...SAYING, active: false });
    expect(result.data?.active).toBe(false);
  });
});

describe("validate document rules", () => {
  const RULE = { stateId: "tn", subject: "buyer", required: ["pan", "gst"] };

  it("keys the rule by state and subject", () => {
    expect(validate("documentRules", RULE).id).toBe("tn-buyer");
  });

  it("refuses an unknown document rather than silently dropping it", () => {
    // Dropping it would show a rule that reads as saved while requiring less
    // than the operator asked for.
    const result = validate("documentRules", {
      ...RULE,
      required: ["pan", "passport"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("passport");
  });

  it("allows an empty requirement list", () => {
    expect(validate("documentRules", { ...RULE, required: [] }).ok).toBe(true);
  });

  it("needs a valid subject", () => {
    expect(validate("documentRules", { ...RULE, subject: "auditor" }).ok).toBe(false);
  });
});

describe("validate settings", () => {
  const POLICY = { ...DEFAULT_POLICY } as Record<string, number>;

  it("accepts the shipped defaults", () => {
    const result = validate("settings", POLICY);
    expect(result.ok).toBe(true);
    expect(result.id).toBe("policy");
  });

  it("refuses a value outside its declared bounds", () => {
    const result = validate("settings", { ...POLICY, expiringSoonDays: 3000 });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("between");
  });

  it("refuses a use-soon band at or below today-only", () => {
    // Otherwise stock jumps from fresh to end-of-life with no warning.
    const result = validate("settings", {
      ...POLICY,
      endOfLifeHours: 60,
      useSoonHours: 60,
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("use-soon");
  });

  it("refuses a non-numeric value", () => {
    expect(validate("settings", { ...POLICY, thinSupplyFarmers: "lots" }).ok).toBe(
      false,
    );
  });
});

describe("produce extras", () => {
  it("stores a shelf life and rejects an absurd one", () => {
    expect(validate("produce", { ...CROP, shelfLifeHours: 96 }).data?.shelfLifeHours).toBe(96);
    expect(validate("produce", { ...CROP, shelfLifeHours: 0 }).ok).toBe(false);
    expect(validate("produce", { ...CROP, shelfLifeHours: 20000 }).ok).toBe(false);
  });

  it("treats a blank shelf life as unset, not as zero", () => {
    expect(validate("produce", { ...CROP, shelfLifeHours: "" }).data?.shelfLifeHours).toBeNull();
  });

  it("keeps grading notes per grade and drops empty ones", () => {
    const result = validate("produce", {
      ...CROP,
      grading: { a: { en: "Firm, 55mm+" }, b: { en: "  " }, c: { en: "Soft" } },
    });
    expect(result.data?.grading).toEqual({
      a: { en: "Firm, 55mm+" },
      c: { en: "Soft" },
    });
  });
});

describe("district minimum", () => {
  const DISTRICT = { stateId: "tn", name: "Salem" };

  it("stores a minimum in paise", () => {
    expect(
      validate("districts", { ...DISTRICT, minOrderValue: 1_200_000 }).data
        ?.minOrderValue,
    ).toBe(1_200_000);
  });

  it("treats blank as unset so the platform default applies", () => {
    // Not zero — zero would let a single crate trigger a vehicle run.
    expect(
      validate("districts", { ...DISTRICT, minOrderValue: "" }).data?.minOrderValue,
    ).toBeNull();
  });

  it("rejects a negative minimum", () => {
    expect(validate("districts", { ...DISTRICT, minOrderValue: -1 }).ok).toBe(false);
  });
});

describe("undeletable collections", () => {
  it("protects the policy singleton and nothing else", () => {
    expect(isDeletable("settings")).toBe(false);
    for (const collection of ["produce", "states", "packs", "phrases"] as const) {
      expect(isDeletable(collection)).toBe(true);
    }
  });
});

describe("delete dependents", () => {
  it("knows what every editable collection would orphan", () => {
    for (const collection of ["produce", "states", "districts", "places"] as const) {
      expect(DEPENDENTS[collection].length).toBeGreaterThan(0);
    }
  });

  it("blocks a state on its districts and a district on its places", () => {
    expect(DEPENDENTS.states[0].collection).toBe("districts");
    expect(DEPENDENTS.districts[0].collection).toBe("places");
  });
});
