"use client";

import { CheckIcon, HandshakeIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { useReducedMotion } from "motion/react";

import { Reveal } from "@/components/motion/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { BARGAIN_SCRIPT, GRADES, type Grade } from "@/lib/mock/bargain-demo";
import { cn } from "@/lib/utils";

/**
 * How a price is actually reached, played out on a loop.
 *
 * This section exists because the platform removed the thing people expect to
 * see — a published rate to check an offer against. Saying "the price is
 * negotiated" is abstract; watching two people arrive at a number is not.
 *
 * The figures are illustrative and the panel says so. Showing a worked example
 * of a mechanism is honest; inventing a testimonial would not be.
 *
 * **Nothing in here is an English literal.** The rates and the turn order come
 * from `lib/mock/bargain-demo.ts`, which holds no words at all; every string —
 * the messages, the crop, the lot, the party labels, "Grade", "Settled",
 * "Illustrative" and both aria-labels — comes from `t.bargain.demo`. The two
 * halves are matched by position, and `bargain-demo.test.ts` asserts they stay
 * the same length in all six languages.
 */

/** The copy for one round, as the dictionary holds it. */
type RoundCopy = Dictionary["bargain"]["demo"]["rounds"][number];

function RateRow({
  rates,
  gradeLabel,
}: {
  rates: Partial<Record<Grade, number>>;
  /** "Grade", in the reader's language. */
  gradeLabel: string;
}) {
  const priced = GRADES.filter((grade) => rates[grade] !== undefined);

  return (
    <span className="mt-2 flex gap-1.5">
      {priced.map((grade) => (
        <span
          key={grade}
          className="bg-background/60 flex flex-1 flex-col items-center rounded-md px-2 py-1.5 leading-tight"
        >
          {/* The letter is not translated. A, B and C are the platform's grade
              names — they appear on the listing, in the bargain and on the
              docket — so translating the word in front of them is right and
              transliterating the letter after them would not be. */}
          <span className="text-[10px] opacity-70">
            {gradeLabel} {grade}
          </span>
          <span className="tabular text-sm font-semibold">₹{rates[grade]}</span>
        </span>
      ))}
    </span>
  );
}

/** Three dots, while the other side is composing. */
function Typing({ mine }: { mine: boolean }) {
  return (
    <span
      className={cn(
        "flex w-fit gap-1 rounded-xl px-3 py-2.5",
        mine ? "bg-primary/80" : "bg-secondary",
      )}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 animate-bounce rounded-full",
            mine ? "bg-primary-foreground/80" : "bg-muted-foreground/70",
          )}
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** Where the loop has got to. `typing` means the next message is composing. */
interface Playhead {
  round: number;
  shown: number;
  typing: boolean;
}

function advance(state: Playhead): Playhead {
  const total = BARGAIN_SCRIPT[state.round].steps.length;

  // Typing shows before each message, so one message costs two ticks.
  if (state.shown < total) {
    return state.typing
      ? { ...state, typing: false, shown: state.shown + 1 }
      : { ...state, typing: true };
  }

  // Settled — hold, then move to the next bargain.
  return {
    round: (state.round + 1) % BARGAIN_SCRIPT.length,
    shown: 0,
    typing: false,
  };
}

/**
 * Takes the whole dictionary rather than a string per line.
 *
 * It took `title` and `body` as props while the badge, the four rules and the
 * entire scripted conversation were English literals in this file — so the
 * section rendered a translated heading over untranslated copy in every
 * language but English. Two strings passed in and thirty hardcoded is the
 * arrangement that produced that. `LivePrices` beside it already takes `t`.
 */
export function BargainDemo({ t }: { t: Dictionary }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [state, tick] = useReducer(advance, { round: 0, shown: 0, typing: false });

  const demo = t.bargain.demo;
  const script = BARGAIN_SCRIPT[state.round];
  /*
    Falls back to the first round rather than throwing.

    The test keeps every locale the same length as the script, so this should
    never fire. It stays because the alternative failure is a blank landing
    page: a dictionary edited without running the tests should cost the wrong
    caption, not the section.
  */
  const copy: RoundCopy = demo.rounds[state.round] ?? demo.rounds[0];
  const settled = state.shown >= script.steps.length;

  useEffect(() => {
    // Reduced motion gets no loop at all. Beyond the WCAG requirement, an
    // animation that restarts every twenty seconds next to body copy is
    // precisely the thing that setting exists to switch off.
    if (reduced || paused) return;

    const delay = settled ? 3200 : state.typing ? 700 : 500;
    const timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [state, settled, reduced, paused]);

  // With reduced motion, show one bargain complete rather than an empty panel.
  const visible = reduced ? script.steps : script.steps.slice(0, state.shown);
  const done = reduced || settled;
  const composing = script.steps[state.shown];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Badge variant="outline" className="w-fit">
            <HandshakeIcon className="size-3.5" />
            {t.bargain.badge}
          </Badge>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.bargain.title}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            {t.bargain.body}
          </p>

          {/* Keyed by index rather than by the line itself: a translation is
              free to repeat a string, and `key={line}` would collide. */}
          <ul className="mt-2 flex flex-col gap-3">
            {[
              t.bargain.rule1,
              t.bargain.rule2,
              t.bargain.rule3,
              t.bargain.rule4,
            ].map((line, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <CheckIcon className="text-success mt-0.5 size-4 shrink-0" />
                <span className="text-muted-foreground text-sm">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="bg-card relative rounded-2xl border p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-2 pb-3">
            <span className="text-sm font-medium">
              {copy.crop} · {copy.lot}
            </span>

            <span className="flex items-center gap-2">
              <span aria-hidden className="flex gap-1">
                {BARGAIN_SCRIPT.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      i === state.round ? "bg-primary" : "bg-border",
                    )}
                  />
                ))}
              </span>

              {/* Content that animates for more than five seconds needs a way
                  to stop it — and a reader trying to finish the sentence
                  beside it needs that more than the animation needs to run. */}
              {!reduced ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? demo.play : demo.pause}
                >
                  {paused ? (
                    <PlayIcon className="size-3.5" />
                  ) : (
                    <PauseIcon className="size-3.5" />
                  )}
                </Button>
              ) : null}

              <span className="text-faint text-xs">{demo.illustrative}</span>
            </span>
          </div>

          <ol
            className="flex min-h-[24rem] flex-col gap-3"
            aria-label={demo.threadLabel}
          >
            {visible.map((step, i) => {
              const mine = step.party === "buyer";
              return (
                <li
                  // Keyed by round so a new bargain remounts and re-animates
                  // rather than reusing the previous one's rows.
                  key={`${state.round}-${i}`}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                    !reduced &&
                      "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
                  )}
                >
                  {/*
                    No `capitalize` any more. It was styling an English word
                    into a label; the dictionaries carry these already cased,
                    and the property does nothing in the four Indic scripts
                    that have no letter case to change.
                  */}
                  <span className="text-faint px-1 pb-1 text-xs">
                    {step.party === "buyer" ? demo.buyer : demo.farmer}
                  </span>
                  <span
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      step.accept
                        ? "border-success/40 bg-success-soft text-success border"
                        : mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {copy.steps[i] ?? ""}
                    {step.rates ? (
                      <RateRow rates={step.rates} gradeLabel={demo.grade} />
                    ) : null}
                  </span>
                </li>
              );
            })}

            {state.typing && composing && !reduced ? (
              <li
                className={cn(
                  "flex flex-col",
                  composing.party === "buyer" ? "items-end" : "items-start",
                )}
              >
                <Typing mine={composing.party === "buyer"} />
              </li>
            ) : null}
          </ol>

          <div
            className={cn(
              "mt-3 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-opacity",
              done ? "border-success/40 bg-success-soft opacity-100" : "opacity-0",
            )}
            aria-live="polite"
          >
            <span className="text-success flex items-center gap-2 text-sm font-medium">
              <HandshakeIcon className="size-4" />
              {demo.settledLabel}
            </span>
            <span className="text-success tabular text-sm">
              {done ? copy.settled : ""}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
