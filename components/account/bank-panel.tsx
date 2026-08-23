import { LandmarkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  BANK_STATE_LABELS,
  bankState,
  type BankDetails,
} from "@/lib/domain/bank";
import { cn } from "@/lib/utils";

/**
 * The bank details on an account, and how far off being usable they are.
 *
 * Read-only for now, and deliberately so: nothing on the platform writes these
 * yet, and a form that appears to save and does not is the defect this project
 * has already found four times. What this page does do is say plainly what is
 * held, what is missing, and — the part Bug 18 actually turns on — refuse to
 * call it done until every field is present *and* passes its format check.
 *
 * The account number is shown as its last four digits. A payout page open on a
 * shared handset in a village should not put a full account number on screen,
 * and the last four are enough for somebody to recognise their own.
 */

const TONE = {
  complete: "border-success/40 bg-success-soft text-success",
  invalid: "border-destructive/40 bg-destructive-soft text-destructive",
  partial: "border-warning/40 bg-warning-soft text-warning",
  empty: "border-border text-muted-foreground",
} as const;

function tail(accountNumber: string | undefined): string {
  if (!accountNumber) return "—";
  return `•••• ${accountNumber.slice(-4)}`;
}

export function BankPanel({ details }: { details: BankDetails }) {
  const state = bankState(details);

  const rows: [string, string][] = [
    ["Account holder", details.accountName || "—"],
    ["Bank", details.bankName || "—"],
    ["Account number", tail(details.accountNumber)],
    ["IFSC", details.ifsc || "—"],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <LandmarkIcon className="text-muted-foreground size-4" />
          Bank details
        </span>
        <Badge variant="outline" className={cn(TONE[state])}>
          {BANK_STATE_LABELS[state]}
        </Badge>
      </div>

      <dl className="divide-border bg-card divide-y rounded-lg border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-3 px-4 py-3">
            <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
            <dd className="tabular text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground max-w-prose text-sm">
        {state === "complete"
          ? "These details are complete and correctly formed. They have not been checked against the bank itself — that happens with the first payout."
          : state === "invalid"
            ? "Something here does not look right. An IFSC is eleven characters and an account number is nine to eighteen digits. Ask operations to correct it before a payout is due."
            : "Operations record these when they verify you. Until they are complete, a payout cannot be sent."}
      </p>
    </div>
  );
}
