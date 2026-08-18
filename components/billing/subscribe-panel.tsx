"use client";

import { BanknoteIcon, CheckIcon, ClockIcon, CopyIcon, FlaskConicalIcon, InfinityIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PlanCard } from "@/components/billing/plan-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/domain/money";
import {
  SUBSCRIPTION_LABELS,
  type Badge as TermBadge,
  type SubscriptionStatus,
  type Term,
  type TermOption,
} from "@/lib/domain/subscription";
import { loadCheckout, openCheckout } from "@/lib/payments/checkout";

/** What the server already worked out, so the client re-derives none of it. */
export interface SubscriptionView {
  readonly status: SubscriptionStatus | "none";
  readonly termLabel?: string;
  readonly badge?: TermBadge;
  readonly lifetime?: boolean;
  readonly reference?: string;
  readonly amountLabel?: string;
  readonly renewsAtLabel?: string;
  readonly daysLeft?: number;
}

const TONE: Record<SubscriptionStatus | "none", string> = {
  none: "border-border text-muted-foreground",
  requested: "border-warning/40 bg-warning-soft text-warning",
  trialing: "border-primary/40 bg-accent text-foreground",
  active: "border-success/40 bg-success-soft text-success",
  pastDue: "border-warning/40 bg-warning-soft text-warning",
  expired: "border-destructive/40 text-destructive",
  cancelled: "border-border text-muted-foreground",
};

export function SubscribePanel({
  options,
  current,
  payer,
  bypassed = false,
}: {
  /** The ladder this account is offered, priced for their history. */
  options: readonly TermOption[];
  current: SubscriptionView;
  /** Prefills the checkout so nobody retypes what the platform already knows. */
  payer?: { name?: string; email?: string; mobile?: string };
  /** Payment is switched off for testing. Shown, never hidden. */
  bypassed?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Term | null>(null);
  const [reference, setReference] = useState<string | null>(current.reference ?? null);

  // Lifetime is pulled out of the ladder and given its own row beneath it.
  // Ranking it as a seventh rung invites a farmer to read it as "three years,
  // but more", which is not what it is.
  const ladder = options.filter((o) => !o.highlight);
  const lifetime = options.find((o) => o.highlight);

  async function choose(option: TermOption) {
    setPending(option.term);

    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term: option.term }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        planName?: string;
        reference?: string;
        error?: string;
        alreadyActive?: boolean;
        bypassed?: boolean;
      };

      // Payment is switched off: the server already activated it.
      if (response.ok && data.bypassed) {
        setPending(null);
        toast.success("Subscription active (payment bypassed)", {
          description: "No money was taken. Turn the bypass off before going live.",
        });
        router.refresh();
        return;
      }

      if (!response.ok || !data.orderId) {
        if (data.alreadyActive) toast.info("That subscription is already running.");
        else if (response.status === 503) {
          toast.error("Card payment is not switched on here yet.", {
            description: "Ask operations for a bank transfer reference instead.",
          });
        } else toast.error(data.error ?? "Could not start the payment.");
        setPending(null);
        return;
      }

      setReference(data.reference ?? null);

      const ready = await loadCheckout();
      if (!ready) {
        toast.error("Could not load the payment window.", {
          description: "An ad blocker or a poor connection can stop it. Try again.",
        });
        setPending(null);
        return;
      }

      const result = await openCheckout(
        {
          orderId: data.orderId,
          amount: data.amount ?? 0,
          currency: data.currency ?? "INR",
          keyId: data.keyId ?? "",
          planName: data.planName ?? option.label,
          reference: data.reference ?? "",
        },
        { name: payer?.name, email: payer?.email, contact: payer?.mobile },
      );

      // Dismissed. Not an error — the order stays open.
      if (!result) {
        setPending(null);
        return;
      }

      const verified = await fetch("/api/subscription/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      });

      const outcome = (await verified.json().catch(() => ({}))) as { error?: string };
      setPending(null);

      if (!verified.ok) {
        // The money may well have left their account — the webhook rescues
        // this, so the message must not tell them to pay again.
        toast.error(outcome.error ?? "Payment could not be confirmed.", {
          description:
            "If you were charged, it will be applied automatically within a few minutes.",
        });
        return;
      }

      toast.success("Subscription active", { description: "Everything is unlocked." });
      router.refresh();
    } catch {
      setPending(null);
      toast.error("Could not reach the server. Try again.");
    }
  }

  /**
   * The plan this account is on right now.
   *
   * Matched on the tier id rather than the displayed label — the old check
   * compared `current.termLabel` to `option.label`, so a wording change to
   * either would have silently stopped highlighting anything, and nothing
   * would have failed.
   *
   * Only while the subscription is actually running. An expired plan is not
   * "your plan", it is the plan you had: marking it current would put a green
   * "Your plan" badge on a card whose button says Renew.
   */
  const running = current.status === "active" || current.status === "trialing";

  const isCurrent = (option: TermOption) =>
    running &&
    (option.highlight
      ? current.lifetime === true
      : current.badge?.id === option.badge.id);

  const cta = (option: TermOption) => {
    // Nothing to sell somebody who has already bought it. A live button here
    // invites a second payment for the plan they are on.
    if (isCurrent(option)) {
      return (
        <div className="border-success/40 bg-success-soft text-success flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium">
          <CheckIcon className="size-4" />
          {current.renewsAtLabel ? `Runs to ${current.renewsAtLabel}` : "Your current plan"}
        </div>
      );
    }

    return (
    <Button
      type="button"
      // Violet on the lifetime band: a primary-green button sitting on it is
      // the one colour collision on the page.
      className={
        option.highlight
          ? "w-full bg-stone-800 text-white hover:bg-stone-900 focus-visible:ring-stone-500 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100"
          : "w-full"
      }
      variant={option.recommended && !option.highlight ? "default" : "outline"}
      disabled={pending !== null}
      onClick={() => choose(option)}
    >
      {pending === option.term
        ? bypassed
          ? "Activating…"
          : "Opening payment…"
        : bypassed
          ? "Activate (no payment)"
          : current.status === "expired" || current.status === "pastDue"
            ? "Renew"
            : `Pay ${formatMoney(option.price)}`}
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {bypassed ? (
        <div className="border-warning/40 bg-warning-soft text-warning flex items-start gap-2.5 rounded-lg border px-4 py-3">
          <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" />
          <span className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">Payment is bypassed for testing</span>
            <span className="opacity-90">
              Choosing a term activates it immediately and charges nothing. Unset PAYMENTS_BYPASS
              to take real payments.
            </span>
          </span>
        </div>
      ) : null}

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${TONE[current.status]}`}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheckIcon className="size-4 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="flex items-center gap-2 text-sm font-medium">
              {current.status === "none"
                ? "No subscription"
                : SUBSCRIPTION_LABELS[current.status]}
              {current.termLabel ? ` · ${current.termLabel}` : ""}
              {/* The badge they hold, shown wherever their standing is. */}
              {current.badge && current.status === "active" ? (
                <Badge variant="outline" className={current.badge.className}>
                  {current.badge.label}
                </Badge>
              ) : null}
            </span>
            <span className="text-xs opacity-80">
              {current.status === "none"
                ? "Browsing is free. Choose a term to start trading."
                : current.status === "requested"
                  ? "Starts the moment your payment clears."
                  : current.lifetime
                    ? "Yours for good. Nothing to renew."
                    : current.renewsAtLabel
                      ? `Runs to ${current.renewsAtLabel}`
                      : ""}
            </span>
          </div>
        </div>

        {current.lifetime ? (
          <Badge variant="outline" className="border-stone-500/50 text-stone-700 dark:text-stone-300">
            <InfinityIcon className="size-3" />
            Lifetime
          </Badge>
        ) : typeof current.daysLeft === "number" && current.daysLeft > 0 ? (
          <Badge variant="outline" className="tabular-nums">
            {current.daysLeft} days left
          </Badge>
        ) : null}
      </div>

      {reference && current.status !== "active" && !bypassed ? (
        <div className="border-border flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <BanknoteIcon className="size-4" /> Paying by bank transfer instead?
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-background rounded border px-2 py-1 font-mono text-base tracking-wider">
              {reference}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(reference);
                toast.success("Reference copied");
              }}
            >
              <CopyIcon className="size-3.5" />
              Copy
            </Button>
            {current.amountLabel ? (
              <span className="text-sm">
                Amount: <span className="font-medium">{current.amountLabel}</span>
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
            Quote this reference on the transfer. Operations switch you on once it clears —
            usually the same working day. Paying by card or UPI above is instant.
          </p>
        </div>
      ) : null}

      {/* The ladder. Longer terms cost less per month and nothing else changes
          — every term buys the same capabilities, because a farmer who paid
          less should not be a farmer who can sell less. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ladder.map((option) => (
          <PlanCard
            key={option.term}
            option={option}
            current={isCurrent(option)}
            footer={cta(option)}
          />
        ))}
      </div>

      {lifetime ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              or stop paying altogether
            </span>
            <span className="to-border h-px flex-1 bg-gradient-to-r from-transparent" />
          </div>
          <PlanCard option={lifetime} current={isCurrent(lifetime)} footer={cta(lifetime)} />
        </div>
      ) : null}
    </div>
  );
}
