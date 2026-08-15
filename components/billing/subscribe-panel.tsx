"use client";

import { BanknoteIcon, ClockIcon, CopyIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PlanCard } from "@/components/billing/plan-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/domain/money";
import {
  SUBSCRIPTION_LABELS,
  type BillingPeriod,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/domain/subscription";

/** What the server already worked out, so the client does not re-derive it. */
export interface SubscriptionView {
  readonly status: SubscriptionStatus | "none";
  readonly planName?: string;
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
  plans,
  current,
}: {
  plans: readonly Plan[];
  current: SubscriptionView;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [pending, setPending] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(current.reference ?? null);

  async function choose(plan: Plan) {
    setPending(plan.id);
    let response: Response;
    try {
      response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id, period }),
      });
    } catch {
      setPending(null);
      toast.error("Could not reach the server. Try again.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      reference?: string;
      error?: string;
      alreadyActive?: boolean;
    };
    setPending(null);

    if (!response.ok) {
      toast.error(data.error ?? "Could not start that subscription.");
      return;
    }
    if (data.alreadyActive) {
      toast.info("That subscription is already running.");
      return;
    }

    setReference(data.reference ?? null);
    toast.success("Reference created. Pay using it and operations will switch you on.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${TONE[current.status]}`}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheckIcon className="size-4 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">
              {current.status === "none"
                ? "No subscription"
                : SUBSCRIPTION_LABELS[current.status]}
              {current.planName ? ` · ${current.planName}` : ""}
            </span>
            <span className="text-xs opacity-80">
              {current.status === "none"
                ? "Browsing is free. Choose a plan to start trading."
                : current.status === "requested"
                  ? "Starts the moment your payment clears."
                  : current.renewsAtLabel
                    ? `Runs to ${current.renewsAtLabel}`
                    : ""}
            </span>
          </div>
        </div>
        {typeof current.daysLeft === "number" && current.daysLeft > 0 ? (
          <Badge variant="outline" className="tabular-nums">
            {current.daysLeft} days left
          </Badge>
        ) : null}
      </div>

      {/*
        No card form, because there is no gateway. Showing one would take
        details the platform cannot charge and cannot legally store — so this
        says plainly how payment actually works today.
      */}
      {reference ? (
        <div className="border-warning/30 bg-warning-soft flex flex-col gap-2 rounded-lg border px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <BanknoteIcon className="size-4" /> Pay using this reference
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
          <p className="flex items-start gap-1.5 text-xs">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
            Transfer to the platform account with this reference. Operations switch you on once it
            clears — usually the same working day.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPeriod(option)}
            aria-pressed={period === option}
            className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
              period === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            period={period}
            highlight={plan.name === current.planName}
            footer={
              <Button
                type="button"
                className="w-full"
                disabled={pending !== null}
                onClick={() => choose(plan)}
              >
                {pending === plan.id
                  ? "Working…"
                  : current.status === "expired" || current.status === "pastDue"
                    ? "Renew"
                    : `Subscribe — ${formatMoney(period === "yearly" ? plan.yearly : plan.monthly)}`}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
