"use client";

import { CheckIcon, HandshakeIcon } from "lucide-react";
import { useEffect, useReducer } from "react";
import { useReducedMotion } from "motion/react";

import { Reveal } from "@/components/motion/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * How a price is actually reached, played out.
 *
 * This section exists because the platform removed the thing people expect to
 * see — a published rate to check an offer against. Saying "the price is
 * negotiated" is abstract; showing four messages and the moment two numbers
 * meet is not. It is the clearest possible answer to "so who decides what I
 * get paid?"
 *
 * The figures are illustrative and the copy says so. Inventing a testimonial
 * would be a lie; showing a worked example of a mechanism is not.
 */

interface Step {
  readonly party: "farmer" | "buyer";
  readonly text: string;
  readonly rates?: readonly [number, number, number];
  readonly accept?: boolean;
}

const SCRIPT: readonly Step[] = [
  {
    party: "farmer",
    text: "800 kg tomato, picked this morning.",
    rates: [26, 21, 14.5],
  },
  {
    party: "buyer",
    text: "Rate is soft this week. This is what I can do today.",
    rates: [22, 18, 13],
  },
  { party: "farmer", text: "Yesterday it went at 24." },
  {
    party: "buyer",
    text: "Meeting you most of the way. Loading tomorrow at six.",
    rates: [24, 19.5, 13.5],
  },
  { party: "farmer", text: "Agreed.", rates: [24, 19.5, 13.5], accept: true },
];

const GRADES = ["A", "B", "C"] as const;

function RateRow({ rates }: { rates: readonly [number, number, number] }) {
  return (
    <span className="mt-2 flex gap-2">
      {GRADES.map((grade, i) => (
        <span
          key={grade}
          className="bg-background/60 flex flex-1 flex-col items-center rounded-md px-2 py-1.5 leading-tight"
        >
          <span className="text-[10px] opacity-70">Grade {grade}</span>
          <span className="tabular text-sm font-semibold">₹{rates[i]}</span>
        </span>
      ))}
    </span>
  );
}

export function BargainDemo({
  title,
  body,
  caption,
}: {
  title: string;
  body: string;
  caption: string;
}) {
  const reduced = useReducedMotion();
  const [shown, advance] = useReducer(
    (n: number) => (n >= SCRIPT.length ? n : n + 1),
    // With reduced motion the whole exchange is present immediately — the
    // point is the outcome, and nobody should have to wait through an
    // animation to read it.
    reduced ? SCRIPT.length : 0,
  );

  useEffect(() => {
    if (reduced || shown >= SCRIPT.length) return;
    const timer = setTimeout(advance, shown === 0 ? 400 : 1400);
    return () => clearTimeout(timer);
  }, [shown, reduced]);

  const settled = shown >= SCRIPT.length;

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
              "Every offer prices all three grades at once, so grading at the farm gate settles the price instead of reopening it.",
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
            <span className="text-sm font-medium">Tomato · 800 kg</span>
            <span className="text-faint text-xs">Illustrative</span>
          </div>

          <ol
            className="flex min-h-[26rem] flex-col gap-3"
            aria-label="An example price negotiation"
          >
            {SCRIPT.slice(0, shown).map((step, i) => {
              const mine = step.party === "buyer";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex flex-col",
                    mine ? "items-end" : "items-start",
                    !reduced && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
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
          </ol>

          <div
            className={cn(
              "mt-3 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-opacity",
              settled
                ? "border-success/40 bg-success-soft opacity-100"
                : "opacity-0",
            )}
            aria-live="polite"
          >
            <span className="text-success flex items-center gap-2 text-sm font-medium">
              <HandshakeIcon className="size-4" />
              Settled
            </span>
            <span className="text-success tabular text-sm">
              {settled ? caption : ""}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
