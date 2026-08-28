import { describe, expect, it } from "vitest";

import { getDictionary } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/config";

import { BARGAIN_SCRIPT } from "./bargain-demo";

/**
 * The landing page's bargain demo is assembled from two halves: the rates and
 * turn order in `bargain-demo.ts`, and the words in each dictionary's
 * `bargain.demo`. They are matched by position, and the type system cannot
 * check that — `Dictionary` fixes the shape of an array but says nothing about
 * its length.
 *
 * So a translator dropping one line of a five-line exchange would typecheck,
 * build, deploy, and render a message bubble containing a grade chip and no
 * sentence. Only in one language, only on the third round of an animation that
 * takes twenty seconds to reach it — which is to say, never in review.
 */
describe("the bargain demo's script and its copy", () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      const demo = getDictionary(locale).bargain.demo;

      it("has a round for every scripted bargain", () => {
        expect(demo.rounds).toHaveLength(BARGAIN_SCRIPT.length);
      });

      it("has a message for every scripted step", () => {
        BARGAIN_SCRIPT.forEach((round, i) => {
          expect(demo.rounds[i].steps).toHaveLength(round.steps.length);
        });
      });

      /*
        An empty string is the shape a half-finished translation takes, and it
        renders as a bubble with a price in it and nothing said — which reads as
        a bug in the animation rather than a missing line.
      */
      it("leaves nothing blank", () => {
        for (const round of demo.rounds) {
          expect(round.crop.trim()).not.toBe("");
          expect(round.lot.trim()).not.toBe("");
          expect(round.settled.trim()).not.toBe("");
          for (const step of round.steps) expect(step.trim()).not.toBe("");
        }

        for (const label of [
          demo.farmer,
          demo.buyer,
          demo.grade,
          demo.settledLabel,
          demo.illustrative,
          demo.play,
          demo.pause,
          demo.threadLabel,
        ]) {
          expect(label.trim()).not.toBe("");
        }
      });
    });
  }

  /*
    The point of translating it at all. Every locale passing the checks above
    while holding the English strings would satisfy them completely.
  */
  it("is actually translated, not copied from English", () => {
    const english = getDictionary("en").bargain.demo;

    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const demo = getDictionary(locale).bargain.demo;
      const same = demo.rounds.flatMap((round, i) =>
        round.steps.filter((step, j) => step === english.rounds[i].steps[j]),
      );
      expect(same, `${locale} still has English messages`).toEqual([]);
    }
  });
});
