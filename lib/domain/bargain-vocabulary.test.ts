import { describe, expect, it } from "vitest";

import {
  BARGAIN_VOCABULARY,
  canSay,
  phraseById,
  phrasesFor,
  say,
} from "./bargain-vocabulary";

/** Every language the bargain screens offer. */
const LOCALES = ["en", "ta", "te", "kn", "ml", "hi"] as const;

describe("the vocabulary itself", () => {
  it("has no duplicate ids", () => {
    const ids = BARGAIN_VOCABULARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exists in every language the platform offers", () => {
    // A phrase missing a translation falls back to English, which for a farmer
    // who reads only Tamil is a message they cannot read. The list is short
    // precisely so this can be a hard requirement.
    for (const phrase of BARGAIN_VOCABULARY) {
      for (const locale of LOCALES) {
        expect(
          phrase.text[locale],
          `${phrase.id} has no ${locale}`,
        ).toBeTruthy();
      }
    }
  });

  it("carries no digits — a phrase is not a way to pass a number", () => {
    // The point of a fixed list is that neither side can put a phone number, a
    // price or an account number into the thread.
    for (const phrase of BARGAIN_VOCABULARY) {
      for (const locale of LOCALES) {
        expect(phrase.text[locale], `${phrase.id} / ${locale}`).not.toMatch(/[0-9]/);
      }
    }
  });
});

describe("who may say what", () => {
  it("gives each side its own phrases plus the shared ones", () => {
    const farmer = phrasesFor("farmer").map((p) => p.id);
    const buyer = phrasesFor("buyer").map((p) => p.id);

    expect(farmer).toContain("cannot-split");
    expect(farmer).not.toContain("collect-today");

    expect(buyer).toContain("collect-today");
    expect(buyer).not.toContain("cannot-split");

    // Shared ones reach both.
    expect(farmer).toContain("grading-at-pickup");
    expect(buyer).toContain("grading-at-pickup");
  });

  it("refuses a phrase from the wrong side", () => {
    expect(canSay("buyer", "cannot-split")).toBe(false);
    expect(canSay("farmer", "collect-today")).toBe(false);
  });

  it("allows a shared phrase from either", () => {
    expect(canSay("farmer", "not-interested")).toBe(true);
    expect(canSay("buyer", "not-interested")).toBe(true);
  });

  it("refuses anything not on the list", () => {
    // The refusal that matters: this is what a request carrying typed text or a
    // phone number arrives as.
    expect(canSay("buyer", "call-me-on-98430-11204")).toBe(false);
    expect(canSay("farmer", "")).toBe(false);
    expect(phraseById("nope")).toBeUndefined();
  });
});

describe("say", () => {
  it("returns the reader's language", () => {
    const phrase = phraseById("price-is-final")!;
    expect(say(phrase, "ta")).toBe(phrase.text.ta);
  });

  it("falls back to English for a language nobody has translated", () => {
    const phrase = phraseById("price-is-final")!;
    expect(say(phrase, "fr")).toBe(phrase.text.en);
  });
});
