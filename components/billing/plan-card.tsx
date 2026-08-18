import { CheckIcon, InfinityIcon, SparklesIcon } from "lucide-react";

import { formatMoney } from "@/lib/domain/money";
import {
  perMonth,
  savingPercent,
  STANDARD_TERMS,
  type TermOption,
} from "@/lib/domain/subscription";
import { cn } from "@/lib/utils";

/**
 * One rung of the ladder.
 *
 * The ladder has to *look* like a ladder, or the seven cards read as seven
 * unrelated products and the eye picks whichever is cheapest. So each tier
 * carries a colour that escalates — muted, bronze, silver, gold, teal, sky,
 * its accent — used in three places at once: the bar across the top, the badge
 * chip and the ring on hover. Nothing else changes between them, which is the
 * point: the colour is the only signal, so it does the whole job.
 *
 * The bar under the price is the honest version of the argument. It draws the
 * monthly cost as a fraction of the one-month price, so three years being a
 * quarter of the width of one month is visible before the numbers are read.
 *
 * Lifetime is not on the ladder at all. It is a different proposition — one
 * payment and the question never comes back — and given a surface of its own
 * rather than a seventh shade of the same card.
 */

interface Tier {
  /** The bar across the top, and the price. */
  readonly bar: string;
  readonly chip: string;
  readonly ring: string;
  readonly fill: string;
}

const TIERS: Record<string, Tier> = {
  member: {
    bar: "from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500",
    chip: "border-border text-muted-foreground bg-secondary",
    ring: "hover:border-slate-400/60",
    fill: "bg-slate-400",
  },
  bronze: {
    bar: "from-amber-700/60 to-amber-600",
    chip: "border-amber-700/30 bg-amber-700/10 text-amber-800 dark:text-amber-500",
    ring: "hover:border-amber-600/50",
    fill: "bg-amber-600",
  },
  silver: {
    bar: "from-slate-400 to-slate-300",
    chip: "border-slate-400/40 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    ring: "hover:border-slate-400/60",
    fill: "bg-slate-400",
  },
  gold: {
    bar: "from-amber-500 to-yellow-400",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    ring: "hover:border-amber-500/60",
    fill: "bg-amber-500",
  },
  platinum: {
    bar: "from-teal-500 to-emerald-400",
    chip: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-400",
    ring: "hover:border-teal-500/60",
    fill: "bg-teal-500",
  },
  diamond: {
    bar: "from-sky-500 to-cyan-400",
    chip: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    ring: "hover:border-sky-500/60",
    fill: "bg-sky-500",
  },
  /*
    Ink and gold, not violet.

    Founder sits above Diamond on a ladder that already spends amber on Gold,
    teal on Platinum and sky on Diamond, and the brand green means "the
    platform" — franchise wears it. Violet was the only colour left rather than
    a colour anybody chose, and at the size this card is drawn it read as a
    different product bolted onto the page.

    Graphite with a gold hairline is the one premium signal that collides with
    nothing here, and it is the convention every reader already knows from a
    card in their wallet. Both halves carry dark-mode variants: graphite on a
    dark background is invisible, which is how a "premium" tier ends up looking
    like a disabled one.
  */
  founder: {
    bar: "from-stone-700 via-amber-400 to-stone-700 dark:from-stone-300 dark:to-stone-300",
    chip: "border-stone-500/50 bg-stone-500/10 text-stone-700 dark:text-stone-200",
    ring: "hover:border-stone-500/70",
    fill: "bg-stone-700 dark:bg-stone-300",
  },
  franchise: {
    bar: "from-primary to-emerald-500",
    chip: "border-primary/40 bg-primary/10 text-primary",
    ring: "hover:border-primary/60",
    fill: "bg-primary",
  },
};

const BASELINE = STANDARD_TERMS.find((t) => t.term === "m1")!.price.minorUnits;

export function PlanCard({
  option,
  selected = false,
  footer,
}: {
  option: TermOption;
  selected?: boolean;
  footer?: React.ReactNode;
}) {
  const tier = TIERS[option.badge.id] ?? TIERS.member;
  const monthly = perMonth(option);
  const saving = savingPercent(option);

  if (option.highlight) return <LifetimeCard option={option} footer={footer} />;

  return (
    <div
      className={cn(
        "group bg-card relative flex flex-col gap-4 overflow-hidden rounded-xl border pt-5 pb-4 transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        tier.ring,
        option.recommended
          ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
          : selected
            ? "border-primary/40"
            : "border-border",
      )}
    >
      {/* The tier, as a stripe. Read before any word on the card. */}
      <span
        className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tier.bar)}
        aria-hidden
      />

      {option.recommended ? (
        <span className="bg-primary text-primary-foreground absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          Popular
        </span>
      ) : null}

      <div className="flex flex-col gap-3 px-5">
        <div className="flex flex-col gap-1.5">
          <span
            className={cn(
              "w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium",
              tier.chip,
            )}
          >
            {option.badge.label}
          </span>
          <span className="text-muted-foreground text-sm">{option.label}</span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-4xl leading-none tracking-tight tabular-nums">
            {formatMoney(option.price)}
          </span>
        </div>

        {monthly !== undefined ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted-foreground tabular-nums">
                {formatMoney({ minorUnits: monthly, currency: option.price.currency })} a month
              </span>
              {saving > 0 ? (
                <span className="text-success font-medium tabular-nums">−{saving}%</span>
              ) : null}
            </div>

            {/*
              The monthly rate drawn against the one-month price. A quarter of
              the width says "a quarter of the cost" faster than the figures do,
              and it is the same comparison the numbers make rather than a
              second, prettier claim.
            */}
            <div className="bg-secondary h-1 overflow-hidden rounded-full" aria-hidden>
              <span
                className={cn("block h-full rounded-full", tier.fill)}
                style={{ width: `${Math.max(6, Math.round((monthly / BASELINE) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-auto px-5 pt-1">{footer}</div> : null}
    </div>
  );
}

/**
 * Lifetime, given its own surface.
 *
 * Deliberately louder than anything else on the page: a gradient ground, a lit
 * border, and the only card that says what it means in words rather than in a
 * number. It is the one decision on this page somebody makes once.
 */
function LifetimeCard({
  option,
  footer,
}: {
  option: TermOption;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {/* A soft bloom behind the card. Blurred and inert, so it reads as light
          on the page rather than as another edge to parse. */}
      <span
        className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-stone-700/20 via-amber-500/25 to-stone-700/20 blur-xl"
        aria-hidden
      />

      {/*
        A band, not a card. Sitting in one column of a three-column grid left
        it marooned beside two empty cells, which made the most expensive thing
        on the page look like the leftover. Across the full width it gets the
        room the decision deserves, and the three parts — what it costs, what
        that buys, and the way in — sit side by side instead of stacked.
      */}
      <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-stone-500/50 bg-gradient-to-br from-stone-500/[0.10] via-transparent to-amber-500/[0.10] p-6 md:flex-row md:items-center md:gap-10 dark:from-stone-400/[0.14] dark:to-amber-400/[0.14]">
        <span
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-stone-700 via-amber-400 to-stone-700 dark:from-stone-300 dark:to-stone-300"
          aria-hidden
        />
        <span className="absolute top-4 right-4 rounded-full bg-stone-800 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white uppercase dark:bg-stone-200 dark:text-stone-900">
          Best value
        </span>

        <div className="flex shrink-0 flex-col gap-2 pt-1">
          <span className="w-fit rounded-full border border-stone-500/50 bg-stone-500/10 px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:text-stone-200">
            <SparklesIcon className="mr-1 inline size-3" />
            {option.badge.label}
          </span>
          <span className="font-heading bg-gradient-to-r from-stone-800 to-amber-600 bg-clip-text text-5xl leading-none tracking-tight text-transparent tabular-nums sm:text-6xl dark:from-stone-100 dark:to-amber-300">
            {formatMoney(option.price)}
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">
            <InfinityIcon className="size-4" />
            {option.label} — pay once, never again
          </span>
        </div>

        {/* A rule between the price and what it buys, on wide screens only. */}
        <span className="hidden w-px self-stretch bg-stone-500/25 md:block" aria-hidden />

        <ul className="flex flex-1 flex-col gap-2.5">
          {[
            "No renewals, ever",
            "Locked against every price rise",
            "Founder badge on your listings and bargains",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              {line}
            </li>
          ))}
        </ul>

        {footer ? <div className="w-full shrink-0 md:w-56">{footer}</div> : null}
      </div>
    </div>
  );
}
