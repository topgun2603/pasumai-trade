"use client";

import {
  CheckIcon,
  InboxIcon,
  PhoneIcon,
  SproutIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { STATUS_LABELS, type EnquiryStatus, type Interest } from "@/lib/domain/enquiry";

/**
 * People who asked to be called.
 *
 * The form behind this has been on the landing page since the beginning and
 * went nowhere — it waited half a second and said "we will call you". This is
 * the other end of it, finally built.
 *
 * A row is a person, not a ticket. The mobile number is the first thing on it
 * and a `tel:` link, because the only action that matters here is ringing them,
 * and an operator should not have to copy a number out of a table to do it.
 */

export interface EnquiryRow {
  readonly id: string;
  readonly interest: Interest;
  readonly name: string;
  readonly organisation?: string;
  readonly mobile: string;
  readonly district: string;
  readonly message?: string;
  readonly status: EnquiryStatus;
  /** Pre-formatted on the server so both renders agree. */
  readonly askedLabel: string;
  readonly notes: Array<{ at: string; operator?: string; status: string; message?: string }>;
}

const STATUS_STYLE: Record<EnquiryStatus, string> = {
  new: "border-warning/40 bg-warning-soft text-warning",
  contacted: "border-primary/40 text-primary",
  converted: "border-success/40 text-success",
  closed: "text-muted-foreground",
};

type Move = "contacted" | "converted" | "closed";

const PROMPTS: Record<Move, string> = {
  contacted: "What happened on the call? (optional)",
  converted: "Which account was opened? (optional)",
  closed: "Why? Otherwise somebody rings them again.",
};

export function EnquiryQueue({ rows }: { rows: EnquiryRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; move: Move } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function move(row: EnquiryRow, next: Move) {
    const note = notes[row.id] ?? "";

    // Closing is the one that demands words, because it is the one that tells
    // the next operator not to ring this person again.
    if (next === "closed" && !note.trim()) {
      setAsking({ id: row.id, move: next });
      return;
    }

    setPending(row.id);
    let response: Response;
    try {
      response = await fetch(`/api/enquiries/${row.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next, message: note }),
      });
    } catch {
      setPending(null);
      toast.error("Could not reach the server.");
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(null);

    if (!response.ok) {
      toast.error(data.error ?? "Could not record that.");
      return;
    }

    setAsking(null);
    setNotes((n) => ({ ...n, [row.id]: "" }));
    toast.success(`${row.name} — ${STATUS_LABELS[next].toLowerCase()}`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
        <InboxIcon className="size-7" />
        <p className="max-w-sm text-sm">
          Nobody has asked yet. Enquiries from the landing page arrive here, and the rail counts
          the ones nobody has called.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Who</TableHead>
            <TableHead>Wants to</TableHead>
            <TableHead>Where</TableHead>
            <TableHead>Asked</TableHead>
            <TableHead className="text-right">Next</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const busy = pending === row.id;

            return (
              <TableRow key={row.id}>
                <TableCell className="align-top">
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">{row.name}</span>
                    {/* The point of the row. A number an operator has to copy
                        out of a table is a call that happens later. */}
                    <a
                      href={`tel:+91${row.mobile}`}
                      className="text-primary flex items-center gap-1 text-sm hover:underline"
                    >
                      <PhoneIcon className="size-3" />
                      {row.mobile}
                    </a>
                    {row.organisation ? (
                      <span className="text-muted-foreground text-xs">{row.organisation}</span>
                    ) : null}
                  </span>

                  {row.message ? (
                    <p className="text-muted-foreground mt-2 max-w-md text-xs">{row.message}</p>
                  ) : null}

                  {asking?.id === row.id ? (
                    <Input
                      autoFocus
                      className="mt-2"
                      placeholder={PROMPTS[asking.move]}
                      value={notes[row.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") move(row, asking.move);
                        if (e.key === "Escape") setAsking(null);
                      }}
                    />
                  ) : null}

                  {row.notes.length > 0 ? (
                    <ol className="border-border mt-2 flex flex-col gap-1 border-l pl-3">
                      {row.notes.map((note, i) => (
                        <li key={i} className="text-xs">
                          <span className="text-muted-foreground">
                            {STATUS_LABELS[note.status as EnquiryStatus] ?? note.status}
                          </span>
                          {note.message ? (
                            <span className="text-foreground"> — {note.message}</span>
                          ) : null}
                          <span className="text-faint">
                            {" "}
                            · {note.at}
                            {note.operator ? ` · ${note.operator}` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </TableCell>

                <TableCell className="align-top">
                  <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                    {row.interest === "farmer" ? (
                      <SproutIcon className="size-3.5" />
                    ) : (
                      <StoreIcon className="size-3.5" />
                    )}
                    {row.interest === "farmer" ? "Sell produce" : "Buy produce"}
                  </span>
                </TableCell>

                <TableCell className="text-muted-foreground align-top text-sm">
                  {row.district}
                </TableCell>

                <TableCell className="align-top">
                  <span className="flex flex-col items-start gap-1">
                    <Badge variant="outline" className={STATUS_STYLE[row.status]}>
                      {STATUS_LABELS[row.status]}
                    </Badge>
                    <span className="text-faint text-xs whitespace-nowrap">{row.askedLabel}</span>
                  </span>
                </TableCell>

                <TableCell className="align-top">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {row.status === "new" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => move(row, "contacted")}
                      >
                        <PhoneIcon className="size-3.5" />
                        Called
                      </Button>
                    ) : null}
                    {row.status !== "converted" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => move(row, "converted")}
                      >
                        <CheckIcon className="size-3.5" />
                        Opened
                      </Button>
                    ) : null}
                    {row.status !== "closed" && row.status !== "converted" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => move(row, "closed")}
                      >
                        <XIcon className="size-3.5" />
                        Close
                      </Button>
                    ) : null}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
