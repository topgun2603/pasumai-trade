"use client";

import {
  BadgeCheckIcon,
  MessageSquareIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CHECK_LABELS, type CheckKind, type CheckState } from "@/lib/domain/kyc";
import type { Role } from "@/lib/auth/claims";

/**
 * What operations already decided, and what they decided it on.
 *
 * The queue answers "what is waiting". It could not answer the question an
 * operator asks straight afterwards — *did we already see this one, and what
 * did we say?* — because a check leaves the queue the moment it is decided and
 * there was nowhere it went. An account approved in error, or a firm asking why
 * it was refused two weeks ago, left nothing to look at.
 *
 * So every decided check is kept in view with the evidence it was decided on,
 * the operator who decided it, and the conversation that led there. The
 * documents matter most: "approved" with no photograph behind it is a claim
 * about a decision rather than a record of one.
 */

export interface DecidedRow {
  readonly key: string;
  readonly accountId: string;
  readonly role: Role;
  readonly name: string;
  readonly district: string;
  readonly kind: CheckKind;
  readonly state: CheckState;
  readonly reference?: string;
  /** Who decided, and when — both pre-formatted on the server. */
  readonly operator?: string;
  readonly decidedLabel: string;
  /** For sorting, since the label is human-readable rather than sortable. */
  readonly decidedAt: number;
  readonly reason?: string;
  readonly documents: ViewableDocument[];
  readonly notes: Array<{ by: "operations" | "applicant"; state: string; message?: string; at: string }>;
}

const DECISION: Record<string, { label: string; className: string; Icon: typeof BadgeCheckIcon }> = {
  verified: {
    label: "Approved",
    className: "border-success/40 text-success",
    Icon: BadgeCheckIcon,
  },
  failed: {
    label: "Refused",
    className: "border-destructive/40 text-destructive",
    Icon: XIcon,
  },
  moreInfo: {
    label: "Asked",
    className: "border-warning/40 bg-warning-soft text-warning",
    Icon: MessageSquareIcon,
  },
  reupload: {
    label: "Sent back",
    className: "border-warning/40 bg-warning-soft text-warning",
    Icon: UploadIcon,
  },
};

type Filter = "all" | "verified" | "failed" | "pendingThem";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "verified", label: "Approved" },
  { value: "failed", label: "Refused" },
  { value: "pendingThem", label: "Waiting on them" },
];

export function KycHistory({ rows }: { rows: DecidedRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();

  const shown = rows.filter((row) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "pendingThem"
          ? row.state === "moreInfo" || row.state === "reupload"
          : row.state === filter;

    if (!matchesFilter) return false;
    if (!needle) return true;

    // Name, id and district, because an operator looking something up has one
    // of the three and rarely the same one twice.
    return (
      row.name.toLowerCase().includes(needle) ||
      row.accountId.toLowerCase().includes(needle) ||
      row.district.toLowerCase().includes(needle)
    );
  });

  if (rows.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
        Nothing has been decided yet. Approvals and refusals are kept here with the documents
        they were made on.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={
                filter === option.value
                  ? "bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs"
                  : "text-muted-foreground hover:bg-secondary rounded-md px-2.5 py-1 text-xs"
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, account id or district"
            className="pl-8"
            aria-label="Search decided checks"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground px-1 py-6 text-center text-sm">
          Nothing matches that.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => {
            const decision = DECISION[row.state] ?? {
              label: row.state,
              className: "",
              Icon: BadgeCheckIcon,
            };

            return (
              <li key={row.key} className="border-border bg-card rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">
                      {row.name}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {CHECK_LABELS[row.kind]}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-sm">
                      <span className="font-mono">{row.accountId}</span> · {row.role}
                      {row.district ? ` · ${row.district}` : ""}
                    </span>
                  </span>
                  <Badge variant="outline" className={decision.className}>
                    <decision.Icon className="size-3" />
                    {decision.label}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {row.reference ? (
                    <p className="text-muted-foreground font-mono text-xs">{row.reference}</p>
                  ) : null}

                  {/*
                    The evidence, still here after the decision. This is the
                    whole point of the section — an approval you cannot see the
                    document behind is an assertion, not a record.
                  */}
                  <DocumentStrip
                    documents={row.documents}
                    label={`${row.name} — ${CHECK_LABELS[row.kind]}`}
                    emptyNote="No document was uploaded with this check."
                  />

                  <p className="text-faint text-xs">
                    {decision.label.toLowerCase()} {row.decidedLabel}
                    {row.operator ? ` by ${row.operator}` : ""}
                  </p>

                  {row.reason ? (
                    <p className="text-foreground text-sm">{row.reason}</p>
                  ) : null}

                  {row.notes.length > 0 ? (
                    <ol className="border-border flex flex-col gap-1 border-l pl-3">
                      {row.notes.map((note, i) => (
                        <li key={i} className="text-xs">
                          <span
                            className={
                              note.by === "operations" ? "text-muted-foreground" : "text-primary"
                            }
                          >
                            {note.by === "operations" ? "Operations" : "They"}
                          </span>
                          {note.message ? (
                            <span className="text-foreground"> — {note.message}</span>
                          ) : (
                            <span className="text-faint"> — {note.state}</span>
                          )}
                          <span className="text-faint"> · {note.at}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
