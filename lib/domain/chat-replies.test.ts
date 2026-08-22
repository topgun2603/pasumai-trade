import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import {
  missingTranslations,
  replyText,
  STANDARD_REPLIES,
  standardReply,
} from "./chat-replies";

/**
 * These are the only messages that cross a language boundary without anybody
 * translating anything, so the properties worth pinning are the ones that make
 * that true: every reply exists in every language, and a reply that has been
 * retired still renders as whatever was actually sent.
 */
describe("standard replies", () => {
  it("offers at least ten answers", () => {
    expect(STANDARD_REPLIES.length).toBeGreaterThanOrEqual(10);
  });

  it("has every reply in every language", () => {
    // A gap here is a blank bubble for whoever set that language.
    expect(missingTranslations()).toEqual([]);
  });

  it("gives every reply a distinct id", () => {
    const ids = STANDARD_REPLIES.map((reply) => reply.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the operator's button label short enough to scan", () => {
    for (const reply of STANDARD_REPLIES) {
      expect(
        reply.label.length,
        `${reply.id} has a paragraph for a label`,
      ).toBeLessThan(36);
    }
  });

  it("renders the reader's language, not the operator's", () => {
    const english = standardReply("greet")!.text.en;
    for (const locale of LOCALES) {
      const rendered = replyText("greet", locale, "unused fallback");
      expect(rendered).toBe(standardReply("greet")!.text[locale]);
      if (locale !== "en") expect(rendered).not.toBe(english);
    }
  });

  it("falls back to what was sent when the reply no longer exists", () => {
    /*
      A retired or renamed reply must still render as the sentence the operator
      actually sent — the thread is a record of a conversation that happened,
      not a template rendered fresh.
    */
    expect(replyText("retired", "ta", "what was sent")).toBe("what was sent");
    expect(replyText(undefined, "ta", "typed by hand")).toBe("typed by hand");
  });
});
