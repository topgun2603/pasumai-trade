/**
 * The shape of the bargains the landing page plays out — and none of the words.
 *
 * The demo used to hold both here: who speaks, what they price, *and* what they
 * say. The sentences were English literals, so the section animated an English
 * conversation under a Telugu heading whichever language the reader had chosen.
 *
 * They are split because the two halves have different owners. The rates are
 * structural — they drive the grade chips under each message, they have to move
 * in the right direction for the exchange to make sense, and they are the same
 * numbers in every language. The sentences are copy, and copy lives in the
 * dictionaries.
 *
 * The two are matched by position: `BARGAIN_SCRIPT[r].steps[i]` is priced here
 * and worded at `t.bargain.demo.rounds[r].steps[i]`. That pairing is load-
 * bearing and unenforceable by the type system — `Dictionary` fixes the shape
 * of an array but not its length — so `bargain-demo.test.ts` asserts it for
 * every locale. A translation that drops a line would otherwise leave a message
 * priced and unsaid.
 */

export type Grade = "A" | "B" | "C";

export interface ScriptStep {
  readonly party: "farmer" | "buyer";
  /** Only the grades this message prices. */
  readonly rates?: Partial<Record<Grade, number>>;
  readonly accept?: boolean;
}

export interface ScriptRound {
  readonly steps: readonly ScriptStep[];
}

/**
 * Three bargains rather than one, because a single scripted exchange read as a
 * mock-up. Real bargaining has different shapes: one narrows to a single grade,
 * one is a straight concession across all three, one is settled in two messages
 * by a buyer who needs the load today.
 */
export const BARGAIN_SCRIPT: readonly ScriptRound[] = [
  {
    // Tomato — the buyer wants only the top grade, so the rest stays the
    // farmer's to sell. The concession is on grade A alone.
    steps: [
      { party: "farmer", rates: { A: 26, B: 21, C: 14.5 } },
      { party: "buyer", rates: { A: 22 } },
      { party: "farmer" },
      { party: "buyer", rates: { A: 24 } },
      { party: "farmer", rates: { A: 24 }, accept: true },
    ],
  },
  {
    // Banana — all three grades move together, and the two split the
    // difference rather than either side conceding.
    steps: [
      { party: "farmer", rates: { A: 36, B: 30, C: 22 } },
      { party: "buyer", rates: { A: 31, B: 26, C: 19 } },
      { party: "farmer", rates: { A: 34, B: 28.5, C: 21 } },
      { party: "buyer", rates: { A: 33, B: 27.5, C: 20 } },
      { party: "farmer", rates: { A: 33, B: 27.5, C: 20 }, accept: true },
    ],
  },
  {
    // Green chilli — settled in three messages by a buyer who needs it today
    // and takes the asking price rather than spend a round on it.
    steps: [
      { party: "farmer", rates: { A: 78, B: 66 } },
      { party: "buyer", rates: { A: 78 } },
      { party: "farmer", rates: { A: 78 }, accept: true },
    ],
  },
];

export const GRADES: readonly Grade[] = ["A", "B", "C"];
