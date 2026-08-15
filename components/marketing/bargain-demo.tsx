"use client";

import { CheckIcon, HandshakeIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { useReducedMotion } from "motion/react";

import { Reveal } from "@/components/motion/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * How a price is actually reached, played out on a loop.
 *
 * This section exists because the platform removed the thing people expect to
 * see — a published rate to check an offer against. Saying "the price is
 * negotiated" is abstract; watching two people arrive at a number is not.
 *
 * Three bargains rather than one, because a single scripted exchange read as a
 * mock-up. Real bargaining has different shapes: one narrows to a single
 * grade, one is a straight concession across all three, one is settled in two
 * messages by a buyer who needs the load today. Cycling through them shows the
 * mechanism is general rather than a happy path somebody drew once.
 *
 * The figures are illustrative and the panel says so. Showing a worked example
 * of a mechanism is honest; inventing a testimonial would not be.
 */

type Grade = "A" | "B" | "C";

interface Step {
  readonly party: "farmer" | "buyer";
  readonly text: string;
  /** Only the grades this message prices. */
  readonly rates?: Partial<Record<Grade, number>>;
  readonly accept?: boolean;
}

interface Bargain {
  readonly crop: string;
  readonly lot: string;
  readonly steps: readonly Step[];
  readonly settled: string;
}

const BARGAINS: readonly Bargain[] = [
  {
    crop: "Tomato",
    lot: "800 kg",
    settled: "Grade A · ₹24/kg",
    steps: [
      {
        party: "farmer",
        text: "800 kg tomato, picked this morning.",
        rates: { A: 26, B: 21, C: 14.5 },
      },
      { party: "buyer", text: "I only need the top grade this week.", rates: { A: 22 } },
      { party: "farmer", text: "Yesterday grade A went at 24." },
      { party: "buyer", text: "Meeting you most of the way.", rates: { A: 24 } },
      { party: "farmer", text: "Agreed.", rates: { A: 24 }, accept: true },
    ],
  },
  {
    crop: "Banana",
    lot: "1,200 kg",
    settled: "A ₹33 · B ₹27.50 · C ₹20",
    steps: [
      {
        party: "farmer",
        text: "1,200 kg ready. All three grades.",
        rates: { A: 36, B: 30, C: 22 },
      },
      {
        party: "buyer",
        text: "Rate is soft this week. This is what I can do today.",
        rates: { A: 31, B: 26, C: 19 },
      },
      {
        party: "farmer",
        text: "I cannot go below this.",
        rates: { A: 34, B: 28.5, C: 21 },
      },
      {
        party: "buyer",
        text: "Splitting the difference. Loading tomorrow at six.",
        rates: { A: 33, B: 27.5, C: 20 },
      },
      { party: "farmer", text: "Done.", rates: { A: 33, B: 27.5, C: 20 }, accept: true },
    ],
  },
  {
    crop: "Green chilli",
    lot: "260 kg",
    settled: "Grade A · ₹78/kg",
    steps: [
      { party: "farmer", text: "260 kg, graded this morning.", rates: { A: 78, B: 66 } },
      {
        party: "buyer",
        text: "I need it today. Taking grade A at your price.",
        rates: { A: 78 },
      },
      { party: "farmer", text: "Take it.", rates: { A: 78 }, accept: true },
    ],
  },
];

const GRADES: readonly Grade[] = ["A", "B", "C"];

function RateRow({ rates }: { rates: Partial<Record<Grade, number>> }) {
  const priced = GRADES.filter((grade) => rates[grade] !== undefined);

  return (
    <span className="mt-2 flex gap-1.5">
      {priced.map((grade) => (
        <span
          key={grade}
          className="bg-background/60 flex flex-1 flex-col items-center rounded-md px-2 py-1.5 leading-tight"
        >
          <span className="text-[10px] opacity-70">Grade {grade}</span>
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
  const total = BARGAINS[state.round].steps.length;

  // Typing shows before each message, so one message costs two ticks.
  if (state.shown < total) {
    return state.typing
      ? { ...state, typing: false, shown: state.shown + 1 }
      : { ...state, typing: true };
  }

  // Settled — hold, then move to the next bargain.
  return { round: (state.round + 1) % BARGAINS.length, shown: 0, typing: false };
}

export function BargainDemo({
  title,
  body,
}: {
  title: string;
  body: string;
  /** No longer used: each bargain carries its own settled line. */
  caption?: string;
}) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [state, tick] = useReducer(advance, { round: 0, shown: 0, typing: false });

  const bargain = BARGAINS[state.round];
  const settled = state.shown >= bargain.steps.length;

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
  const visible = reduced ? bargain.steps : bargain.steps.slice(0, state.shown);
  const done = reduced || settled;
  const composing = bargain.steps[state.shown];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Badge variant="outline" className="w-fit">
            <HandshakeIcon className="size-3.5" />
            No published rate. No platform price.
          </Badge>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">{body}</p>

          <ul className="mt-2 flex flex-col gap-3">
            {[
              "Bid on one grade or all three. A buyer who wants only the top grade says so, and the rest of the lot stays yours to sell.",
              "Neither side can walk an offer backwards once it is made.",
              "Nobody can accept their own price — an agreement needs both.",
              "The thread is the record. What was agreed, and how, stays readable.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
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
              {bargain.crop} · {bargain.lot}
            </span>

            <span className="flex items-center gap-2">
              <span aria-hidden className="flex gap-1">
                {BARGAINS.map((b, i) => (
                  <span
                    key={b.crop}
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
                  aria-label={paused ? "Play the example" : "Pause the example"}
                >
                  {paused ? (
                    <PlayIcon className="size-3.5" />
                  ) : (
                    <PauseIcon className="size-3.5" />
                  )}
                </Button>
              ) : null}

              <span className="text-faint text-xs">Illustrative</span>
            </span>
          </div>

          <ol
            className="flex min-h-[24rem] flex-col gap-3"
            aria-label="An example price negotiation"
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
                  <span className="text-faint px-1 pb-1 text-xs capitalize">
                    {step.party}
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
                    {step.text}
                    {step.rates ? <RateRow rates={step.rates} /> : null}
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
              Settled
            </span>
            <span className="text-success tabular text-sm">
              {done ? bargain.settled : ""}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
