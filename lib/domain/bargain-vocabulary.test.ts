import { describe, expect, it } from "vitest";

import {
  BARGAIN_VOCABULARY,
  canSay,
  hasDigits,
  phraseById,
  phrasesFor,
  say,
  TOPICS,
  type VocabularyEntry,
} from "./bargain-vocabulary";

/** Every language the bargain screens offer. */
const LOCALES = ["en", "ta", "te", "kn", "ml", "hi"] as const;

const V = BARGAIN_VOCABULARY;

/** A phrase an operator might add from Controls. */
function added(over: Partial<VocabularyEntry> = {}): VocabularyEntry {
  return {
    id: "we-pay-on-collection",
    speaker: "buyer",
    topic: "price",
    active: true,
    text: { en: "We pay on collection." },
    ...over,
  };
}

describe("what the platform ships with", () => {
  it("has no duplicate ids", () => {
    const ids = V.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exists in every language the platform offers", () => {
    // A phrase missing a translation falls back to English, which for a farmer
    // who reads only Tamil is a message they cannot read. The shipped list is
    // short precisely so this can be a hard requirement.
    for (const phrase of V) {
      for (const locale of LOCALES) {
        expect(phrase.text[locale], `${phrase.id} has no ${locale}`).toBeTruthy();
      }
    }
  });

  it("carries no digits — a phrase is not a way to pass a number", () => {
    for (const phrase of V) {
      for (const locale of LOCALES) {
        expect(hasDigits(phrase.text[locale]), `${phrase.id} / ${locale}`).toBe(false);
      }
    }
  });

  it("files every phrase under a known topic", () => {
    for (const phrase of V) {
      expect(TOPICS).toContain(phrase.topic);
    }
  });
});

describe("hasDigits", () => {
  it("catches Latin digits", () => {
    expect(hasDigits("Call me on 98430 11204")).toBe(true);
  });

  it("catches Indic digits, which render as numerals just the same", () => {
    // The obvious way round the rule if it only knew about 0-9.
    expect(hasDigits("என்னை ௯௮௪௩௦ இல் அழைக்கவும்")).toBe(true);
    expect(hasDigits("मुझे ९८४३० पर बुलाओ")).toBe(true);
    expect(hasDigits("ನನ್ನನ್ನು ೯೮೪೩೦ ಗೆ ಕರೆಯಿರಿ")).toBe(true);
  });

  it("leaves ordinary sentences alone", () => {
    expect(hasDigits("We can collect tomorrow.")).toBe(false);
    expect(hasDigits("இதுவே எனது இறுதி விலை.")).toBe(false);
  });
});

describe("who may say what", () => {
  it("gives each side its own phrases plus the shared ones", () => {
    const farmer = phrasesFor(V, "farmer").map((p) => p.id);
    const buyer = phrasesFor(V, "buyer").map((p) => p.id);

    expect(farmer).toContain("cannot-split");
    expect(farmer).not.toContain("collect-today");

    expect(buyer).toContain("collect-today");
    expect(buyer).not.toContain("cannot-split");

    // Shared ones reach both.
    expect(farmer).toContain("grading-at-pickup");
    expect(buyer).toContain("grading-at-pickup");
  });

  it("refuses a phrase from the wrong side", () => {
    expect(canSay(V, "buyer", "cannot-split")).toBe(false);
    expect(canSay(V, "farmer", "collect-today")).toBe(false);
  });

  it("allows a shared phrase from either", () => {
    expect(canSay(V, "farmer", "not-interested")).toBe(true);
    expect(canSay(V, "buyer", "not-interested")).toBe(true);
  });

  it("refuses anything not on the list", () => {
    // The refusal that matters: this is what a request carrying typed text or a
    // phone number arrives as.
    expect(canSay(V, "buyer", "call-me-on-98430-11204")).toBe(false);
    expect(canSay(V, "farmer", "")).toBe(false);
    expect(phraseById(V, "nope")).toBeUndefined();
  });

  it("groups the picker by topic, in bargaining order", () => {
    const topics = phrasesFor(V, "buyer").map((p) => p.topic);
    const ranks = topics.map((t) => TOPICS.indexOf(t));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("a vocabulary operations maintain", () => {
  it("offers a phrase somebody added in Controls", () => {
    const stored = [...V, added()];
    expect(canSay(stored, "buyer", "we-pay-on-collection")).toBe(true);
    expect(phrasesFor(stored, "buyer").map((p) => p.id)).toContain(
      "we-pay-on-collection",
    );
  });

  it("stops offering a phrase switched off, and refuses it", () => {
    const stored = [...V, added({ active: false })];
    expect(phrasesFor(stored, "buyer").map((p) => p.id)).not.toContain(
      "we-pay-on-collection",
    );
    expect(canSay(stored, "buyer", "we-pay-on-collection")).toBe(false);
  });

  it("still finds a retired phrase, so old threads keep rendering", () => {
    // A message quoting it has to go on reading correctly years later; what it
    // must not do is let a new message use it.
    const stored = [...V, added({ active: false })];
    expect(phraseById(stored, "we-pay-on-collection")?.text.en).toBe(
      "We pay on collection.",
    );
  });

  it("does not offer a shipped phrase that the stored list drops", () => {
    // Operations removing a phrase removes it from both consoles, not just one.
    const stored = V.filter((p) => p.id !== "collect-today");
    expect(canSay(stored, "buyer", "collect-today")).toBe(false);
  });
});

describe("say", () => {
  it("returns the reader's language", () => {
    const phrase = phraseById(V, "price-is-final")!;
    expect(say(phrase, "ta")).toBe(phrase.text.ta);
  });

  it("falls back to English for a language nobody has translated", () => {
    const phrase = phraseById(V, "price-is-final")!;
    expect(say(phrase, "fr")).toBe(phrase.text.en);
  });
});
