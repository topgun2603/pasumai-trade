"use client";

import { CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHECK_LABELS, type Check, type CheckKind } from "@/lib/domain/kyc";
import type { Role } from "@/lib/auth/claims";

export interface QueueRow {
  readonly accountId: string;
  readonly role: Role;
  readonly name: string;
  readonly mobile: string;
  readonly district: string;
  readonly waiting: Array<{ kind: CheckKind; reference?: string; submittedLabel?: string }>;
}

/**
 * The manual queue.
 *
 * One row per account, one action per check — approving a whole account in a
 * click would mean approving a document the operator did not look at, which is
 * the failure mode a review queue exists to prevent.
 *
 * A refusal demands a reason, because the person on the other end has to know
 * what to fix and will otherwise telephone to ask.
 */
export function KycQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);

  async function decide(
    row: QueueRow,
    kind: CheckKind,
    decision: "approve" | "reject",
  ) {
    const key = `${row.accountId}:${kind}`;
    const reason = reasons[key] ?? "";

    if (decision === "reject" && !reason.trim()) {
      setRejecting(key);
      return;
    }

    setPending(key);
    let response: Response;
    try {
      response = await fetch("/api/kyc/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: row.role,
          accountId: row.accountId,
          kind,
          decision,
          reason,
        }),
      });
    } catch {
      setPending(null);
      toast.error("Could not reach the server.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      kycState?: string;
      accountStatus?: string;
    };
    setPending(null);

    if (!response.ok) {
      toast.error(data.error ?? "Could not record that.");
      return;
    }

    setRejecting(null);
    toast.success(
      decision === "approve"
        ? data.accountStatus === "verified"
          ? `${row.name} is now fully verified`
          : `${CHECK_LABELS[kind]} approved`
        : `${CHECK_LABELS[kind]} refused`,
    );
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
        <CheckIcon className="size-7" />
        <p className="text-sm">Nothing waiting. Every manual submission has been decided.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.accountId} className="border-border bg-card rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="flex flex-col leading-tight">
              <span className="font-medium">{row.name}</span>
              <span className="text-muted-foreground text-sm">
                <span className="font-mono">{row.accountId}</span> · {row.role} · {row.district}
                {row.mobile ? ` · ${row.mobile}` : ""}
              </span>
            </span>
            <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
              <ClockIcon className="size-3" />
              {row.waiting.length} waiting
            </Badge>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {row.waiting.map((item) => {
              const key = `${row.accountId}:${item.kind}`;
              const busy = pending === key;

              return (
                <li key={item.kind} className="bg-secondary flex flex-col gap-2 rounded-md p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-medium">{CHECK_LABELS[item.kind]}</span>
                      {item.reference ? (
                        <span className="text-muted-foreground font-mono text-xs">
                          {item.reference}
                        </span>
                      ) : null}
                      {item.submittedLabel ? (
                        <span className="text-faint text-xs">
                          submitted {item.submittedLabel}
                        </span>
                      ) : null}
                    </span>

                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decide(row, item.kind, "approve")}
                      >
                        <CheckIcon className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => decide(row, item.kind, "reject")}
                      >
                        <XIcon className="size-3.5" />
                        Refuse
                      </Button>
                    </span>
                  </div>

                  {rejecting === key ? (
                    <Input
                      autoFocus
                      placeholder="Why? They will be shown this."
                      value={reasons[key] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") decide(row, item.kind, "reject");
                        if (e.key === "Escape") setRejecting(null);
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
