import { ArrowRightIcon, CheckIcon, ClockIcon, LockIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { JourneyStep, StepState } from "@/lib/domain/readiness";
import { cn } from "@/lib/utils";

/**
 * The road onto the platform, as a checklist.
 *
 * A server component: every state on it is decided by `farmerJourney`, and
 * recomputing any of it in the browser would be a second opinion nobody asked
 * for.
 *
 * Only the current step gets a button. A checklist where every row is
 * clickable is a checklist that has not decided what to ask for next, and the
 * person reading it has to work out the order themselves.
 */

const MARK: Record<StepState, { icon: typeof CheckIcon; ring: string; label: string }> = {
  done: { icon: CheckIcon, ring: "bg-success text-success-foreground", label: "Done" },
  current: { icon: ArrowRightIcon, ring: "bg-primary text-primary-foreground", label: "Next" },
  waiting: { icon: ClockIcon, ring: "bg-warning-soft text-warning", label: "Waiting" },
  locked: { icon: LockIcon, ring: "bg-secondary text-muted-foreground", label: "Locked" },
  blocked: {
    icon: TriangleAlertIcon,
    ring: "bg-destructive-soft text-destructive",
    label: "On hold",
  },
};

export function JourneyChecklist({ steps }: { steps: readonly JourneyStep[] }) {
  const remaining = steps.filter((s) => s.state !== "done").length;

  return (
    <section className="border-border bg-card flex flex-col gap-1 rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
        <h2 className="font-medium">Getting started</h2>
        <span className="text-muted-foreground text-sm tabular-nums">
          {steps.length - remaining} of {steps.length} done
        </span>
      </div>

      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const mark = MARK[step.state];
          const Icon = mark.icon;
          const last = index === steps.length - 1;

          return (
            <li key={step.id} className="flex gap-3">
              {/* The rail: a dot per step and a line between them, drawn with
                  a border rather than a pseudo-element so it survives a long
                  detail line wrapping to three rows on a phone. */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    mark.ring,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {!last ? <span className="bg-border w-px flex-1" /> : null}
              </div>

              <div className={cn("flex min-w-0 flex-1 flex-col gap-1", last ? "pb-0" : "pb-5")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.state === "locked" && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                  {step.state === "waiting" ? (
                    <span className="text-warning text-xs">{mark.label}</span>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-sm">{step.detail}</p>

                {step.state === "current" && step.href ? (
                  <Button asChild size="sm" className="mt-1 self-start">
                    <Link href={step.href}>
                      {step.id === "verify" ? "Start verification" : "See plans"}
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
