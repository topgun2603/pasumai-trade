"use client";

import { CheckIcon, ClockIcon, MessageSquareIcon, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHECK_LABELS, type CheckKind } from "@/lib/domain/kyc";
import type { Role } from "@/lib/auth/claims";

export interface QueueRow {
  readonly accountId: string;
  readonly role: Role;
  readonly name: string;
  readonly mobile: string;
  readonly district: string;
  readonly waiting: Array<{
    kind: CheckKind;
    reference?: string;
    submittedLabel?: string;
    /** What has already been said about it, oldest first. Dates pre-formatted. */
    notes?: Array<{ by: "operations" | "applicant"; state: string; message?: string; at: string }>;
    /** The photographs, newest first. Signed and short-lived. */
    documents?: ViewableDocument[];
  }>;
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
type Decision = "approve" | "reject" | "askMore" | "askReupload";

/** What the box asks for, which differs by what is being asked. */
const PROMPTS: Record<Decision, string> = {
  approve: "",
  reject: "Why? They will be shown this.",
  askMore: "What do you need from them?",
  askReupload: "What is wrong with it? Otherwise the same photograph comes back.",
};

export function KycQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<{ key: string; decision: Decision } | null>(null);

  async function decide(row: QueueRow, kind: CheckKind, decision: Decision) {
    const key = `${row.accountId}:${kind}`;
    const reason = reasons[key] ?? "";

    /*
      Everything except approval sends somebody away with something to do, and
      one with no words is one they cannot act on. The box opens rather than the
      request going out empty — and it opens labelled for the decision, because
      "why was this refused" and "what is wrong with the photograph" want
      different sentences.
    */
    if (decision !== "approve" && !reason.trim()) {
      setAsking({ key, decision });
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

    setAsking(null);
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

                    {/*
                      Four ways out, in the order an operator reaches for them.
                      Asking is placed before refusing on purpose: most of what
                      arrives is neither right nor fraudulent, and a queue with
                      only yes and no pushes an operator to refuse people over
                      things a sentence would settle.
                    */}
                    <span className="flex flex-wrap gap-2">
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
                        disabled={busy}
                        onClick={() => decide(row, item.kind, "askMore")}
                      >
                        <MessageSquareIcon className="size-3.5" />
                        Ask
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => decide(row, item.kind, "askReupload")}
                      >
                        <UploadIcon className="size-3.5" />
                        Send back
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

                  {/*
                    What is actually being approved. Before this the queue held
                    a masked number and four buttons — an operator "reviewing"
                    a string somebody typed, with nothing to look at and no
                    grounds to send anything back.
                  */}
                  <DocumentStrip
                    documents={item.documents ?? []}
                    label={`${row.name} — ${CHECK_LABELS[item.kind]}`}
                    emptyNote="No document uploaded. Ask for one before approving."
                  />

                  {asking?.key === key ? (
                    <Input
                      autoFocus
                      placeholder={PROMPTS[asking.decision]}
                      value={reasons[key] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") decide(row, item.kind, asking.decision);
                        if (e.key === "Escape") setAsking(null);
                      }}
                    />
                  ) : null}

                  {/* What has already been said. A refusal with no history is a
                      dead end somebody then telephones about. */}
                  {item.notes && item.notes.length > 0 ? (
                    <ol className="border-border flex flex-col gap-1 border-l pl-3">
                      {item.notes.map((n, i) => (
                        <li key={i} className="text-xs">
                          <span
                            className={
                              n.by === "operations" ? "text-muted-foreground" : "text-primary"
                            }
                          >
                            {n.by === "operations" ? "Operations" : "They"}
                          </span>
                          {n.message ? (
                            <span className="text-foreground"> — {n.message}</span>
                          ) : (
                            <span className="text-faint"> — {n.state}</span>
                          )}
                          <span className="text-faint"> · {n.at}</span>
                        </li>
                      ))}
                    </ol>
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
