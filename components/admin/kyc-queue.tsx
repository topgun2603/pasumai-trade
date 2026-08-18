"use client";

import { CheckIcon, ClockIcon, MessageSquareIcon, UploadIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ACCOUNT_GROUPS } from "@/components/admin/kyc-groups";
import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  }>;
  /**
   * Everything this account has uploaded, across every check, newest first.
   *
   * One tile per account rather than one per check. An operator is looking at a
   * person, not at five unrelated submissions that happen to share a name — and
   * the same photograph is often evidence for two checks anyway. Each document
   * is captioned with the check it belongs to, or one tile of four unlabelled
   * pictures would be worse than the five scattered ones it replaced.
   */
  readonly documents?: ViewableDocument[];
}

/**
 * The manual queue, one record per account.
 *
 * One action per check — approving a whole account in a click would mean
 * approving a document the operator did not look at, which is the failure mode
 * a review queue exists to prevent. But one *record* per account, because the
 * decision being made is about a person or a firm and the checks are how it is
 * reached.
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
    <div className="flex flex-col gap-5">
      {ACCOUNT_GROUPS.map((group) => {
        const inGroup = rows.filter((row) => group.roles.includes(row.role));
        if (inGroup.length === 0) return null;

        return (
          <section key={group.key} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {group.title}
              <span className="text-faint font-normal"> · {inGroup.length}</span>
            </h3>

            <ul className="grid gap-3 xl:grid-cols-2">
              {inGroup.map((row) => (
                <li
                  key={row.accountId}
                  className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-muted-foreground text-sm">
                        <span className="font-mono">{row.accountId}</span> · {row.role} ·{" "}
                        {row.district}
                        {row.mobile ? ` · ${row.mobile}` : ""}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className="border-warning/40 bg-warning-soft text-warning"
                    >
                      <ClockIcon className="size-3" />
                      {row.waiting.length} waiting
                    </Badge>
                  </div>

                  {/*
                    What is actually being approved, all of it, once. Before
                    this the queue held a masked number and four buttons — an
                    operator "reviewing" a string somebody typed, with nothing
                    to look at and no grounds to send anything back.
                  */}
                  <DocumentStrip
                    documents={row.documents ?? []}
                    label={row.name}
                    emptyNote="No documents uploaded. Ask for one before approving."
                    grid
                  />

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Check</TableHead>
                          <TableHead className="text-right">Decide</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {row.waiting.map((item) => {
                          const key = `${row.accountId}:${item.kind}`;
                          const busy = pending === key;

                          return (
                            <TableRow key={item.kind} className="hover:bg-transparent">
                              <TableCell className="align-top">
                                <span className="flex flex-col leading-tight">
                                  <span className="text-sm font-medium">
                                    {CHECK_LABELS[item.kind]}
                                  </span>
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

                                {asking?.key === key ? (
                                  <Input
                                    autoFocus
                                    className="mt-2"
                                    placeholder={PROMPTS[asking.decision]}
                                    value={reasons[key] ?? ""}
                                    onChange={(e) =>
                                      setReasons((r) => ({ ...r, [key]: e.target.value }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") decide(row, item.kind, asking.decision);
                                      if (e.key === "Escape") setAsking(null);
                                    }}
                                  />
                                ) : null}

                                {/* What has already been said. A refusal with no
                                    history is a dead end somebody telephones about. */}
                                {item.notes && item.notes.length > 0 ? (
                                  <ol className="border-border mt-2 flex flex-col gap-1 border-l pl-3">
                                    {item.notes.map((n, i) => (
                                      <li key={i} className="text-xs">
                                        <span
                                          className={
                                            n.by === "operations"
                                              ? "text-muted-foreground"
                                              : "text-primary"
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
                              </TableCell>

                              {/*
                                Four ways out, in the order an operator reaches
                                for them. Asking is placed before refusing on
                                purpose: most of what arrives is neither right
                                nor fraudulent, and a queue with only yes and no
                                pushes an operator to refuse people over things
                                a sentence would settle.
                              */}
                              <TableCell className="align-top">
                                <span className="flex flex-wrap justify-end gap-1.5">
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
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
