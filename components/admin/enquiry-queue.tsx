"use client";

import { CheckIcon, PhoneIcon, SproutIcon, StoreIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABELS, type EnquiryStatus, type Interest } from "@/lib/domain/enquiry";

/**
 * People who asked to be called.
 *
 * Rendered through the one data grid, so search, sorting, paging and the card
 * toggle behave the same here as on every other list in the console. The table
 * this replaced was hand-rolled and had none of them — which was fine at four
 * enquiries and useless at four hundred.
 *
 * A row is a person, not a ticket. The mobile number is the first thing on it
 * and a `tel:` link, because the only action that matters is ringing them, and
 * an operator should not have to copy a number out of a table to do it.
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
  /** Milliseconds since it arrived, so the column sorts by age not by wording. */
  readonly askedAt: number;
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

  /** Message, reason box and trail — needed in the card and in the expander. */
  function detail(row: EnquiryRow) {
    return (
      <div className="flex flex-col gap-2">
        {row.message ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{row.message}</p>
        ) : null}

        {asking?.id === row.id ? (
          <Input
            autoFocus
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
          <ol className="border-border flex flex-col gap-1 border-l pl-3">
            {row.notes.map((note, i) => (
              <li key={i} className="text-xs">
                <span className="text-muted-foreground">
                  {STATUS_LABELS[note.status as EnquiryStatus] ?? note.status}
                </span>
                {note.message ? <span className="text-foreground"> — {note.message}</span> : null}
                <span className="text-faint">
                  {" "}
                  · {note.at}
                  {note.operator ? ` · ${note.operator}` : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  const columns: Column<EnquiryRow>[] = [
    {
      key: "name",
      header: "Who",
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.name}</span>
          {/* The point of the row. A number an operator has to copy out of a
              table is a call that happens later. */}
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
      ),
    },
    {
      key: "interest",
      header: "Wants to",
      sortValue: (row) => row.interest,
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          {row.interest === "farmer" ? (
            <SproutIcon className="size-3.5" />
          ) : (
            <StoreIcon className="size-3.5" />
          )}
          {row.interest === "farmer" ? "Sell produce" : "Buy produce"}
        </span>
      ),
    },
    {
      key: "district",
      header: "Where",
      sortValue: (row) => row.district.toLowerCase(),
      cell: (row) => <span className="text-muted-foreground text-sm">{row.district}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => (
        <Badge variant="outline" className={STATUS_STYLE[row.status]}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: "asked",
      header: "Asked",
      // Sorted on the timestamp, not the label: "3 days ago" and "just now"
      // sort alphabetically into nonsense.
      sortValue: (row) => row.askedAt,
      cell: (row) => (
        <span className="text-faint text-xs whitespace-nowrap">{row.askedLabel}</span>
      ),
    },
  ];

  const tabs: FilterTab<EnquiryRow>[] = [
    { value: "waiting", label: "To call", match: (row) => row.status === "new" },
    { value: "contacted", label: "Contacted", match: (row) => row.status === "contacted" },
    { value: "converted", label: "Opened", match: (row) => row.status === "converted" },
    { value: "closed", label: "Closed", match: (row) => row.status === "closed" },
    { value: "all", label: "All" },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      tabs={tabs}
      entityLabel="enquiries"
      searchPlaceholder="Name, number, district or what they wrote"
      // Everything an operator might half-remember, including the message,
      // which is never a column but is often the only thing they recall.
      searchText={(row) =>
        [row.name, row.mobile, row.district, row.organisation, row.message]
          .filter(Boolean)
          .join(" ")
      }
      // The same block in both views. Defaulting to cards would otherwise have
      // hidden the reason box that closing an enquiry requires — the operator
      // would press Close and watch nothing happen.
      expand={(row) => detail(row)}
      rowActions={(row) => {
        const busy = pending === row.id;
        return (
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
        );
      }}
      card={(row) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{row.name}</span>
            <Badge variant="outline" className={STATUS_STYLE[row.status]}>
              {STATUS_LABELS[row.status]}
            </Badge>
          </div>
          <a
            href={`tel:+91${row.mobile}`}
            className="text-primary flex items-center gap-1 text-sm hover:underline"
          >
            <PhoneIcon className="size-3" />
            {row.mobile}
          </a>
          <p className="text-muted-foreground text-xs">
            {row.interest === "farmer" ? "Sell produce" : "Buy produce"} · {row.district} ·{" "}
            {row.askedLabel}
          </p>
          {detail(row)}
        </div>
      )}
    />
  );
}
