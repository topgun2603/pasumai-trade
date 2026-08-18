"use client";

import {
  BadgeCheckIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  SearchIcon,
  TableIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CHECK_LABELS, type CheckKind, type CheckState } from "@/lib/domain/kyc";
import type { Role } from "@/lib/auth/claims";

/**
 * What operations already decided, one record per account.
 *
 * The queue answers "what is waiting". It could not answer the question an
 * operator asks straight afterwards — *did we already see this one, and what
 * did we say?* — because a check leaves the queue the moment it is decided and
 * there was nowhere it went.
 *
 * **Grouped by the account, not by the check.** The first version of this
 * listed every decided check as its own row, so one farmer appeared three times
 * with a third of their documents each and no row that was recognisably them.
 * A verification is a judgement about a person or a firm; the checks are how it
 * was reached. One record per account, holding everything they ever uploaded,
 * is the shape the work actually has.
 *
 * Sectioned by what kind of account it is, because operations do not review a
 * farmer and a transport agency the same way: a farmer clears two checks and an
 * agency five, and reading them in one undifferentiated list means holding the
 * difference in your head on every row.
 */

export interface DecidedCheck {
  readonly kind: CheckKind;
  readonly state: CheckState;
  readonly reference?: string;
  readonly operator?: string;
  readonly decidedLabel: string;
  readonly reason?: string;
  readonly notes: Array<{ by: "operations" | "applicant"; state: string; message?: string; at: string }>;
}

export interface DecidedAccount {
  readonly accountId: string;
  readonly role: Role;
  readonly name: string;
  readonly district: string;
  readonly mobile: string;
  readonly checks: DecidedCheck[];
  /** Everything this account ever uploaded, captioned by check, newest first. */
  readonly documents: ViewableDocument[];
  readonly lastDecidedAt: number;
  readonly lastDecidedLabel: string;
  readonly approved: number;
  readonly refused: number;
  readonly waitingOnThem: number;
}

const DECISION: Record<
  string,
  { label: string; className: string; Icon: typeof BadgeCheckIcon }
> = {
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

/** The three kinds of account, in the order operations meet them. */
const GROUPS: Array<{ key: string; title: string; roles: Role[] }> = [
  { key: "farmers", title: "Farmers", roles: ["farmer"] },
  { key: "buyers", title: "Buyers and franchises", roles: ["buyer", "franchise"] },
  { key: "agencies", title: "Transport and manpower", roles: ["transport", "manpower"] },
];

type Filter = "all" | "verified" | "failed" | "pendingThem";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "verified", label: "Approved" },
  { value: "failed", label: "Refused" },
  { value: "pendingThem", label: "Waiting on them" },
];

export function KycHistory({ accounts }: { accounts: DecidedAccount[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<"table" | "grid">("table");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();

  const shown = accounts.filter((account) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "verified"
          ? account.approved > 0
          : filter === "failed"
            ? account.refused > 0
            : account.waitingOnThem > 0;

    if (!matchesFilter) return false;
    if (!needle) return true;

    // Name, id and district, because an operator looking something up has one
    // of the three and rarely the same one twice.
    return (
      account.name.toLowerCase().includes(needle) ||
      account.accountId.toLowerCase().includes(needle) ||
      account.district.toLowerCase().includes(needle)
    );
  });

  if (accounts.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
        Nothing has been decided yet. Approvals and refusals are kept here with the documents
        they were made on.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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

        <div className="relative ml-auto w-full sm:w-56">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, account id or district"
            className="pl-8"
            aria-label="Search decided accounts"
          />
        </div>

        {/*
          Two ways to read the same records. The table is for working down a
          list — forty accounts, one line each. The grid is for looking at the
          documents, where a photograph the size of a thumbnail in a table cell
          is not much use.
        */}
        <div className="border-border flex shrink-0 rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setLayout("table")}
            aria-pressed={layout === "table"}
            aria-label="Table"
            className={
              layout === "table"
                ? "bg-secondary rounded px-2 py-1"
                : "text-muted-foreground rounded px-2 py-1"
            }
          >
            <TableIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLayout("grid")}
            aria-pressed={layout === "grid"}
            aria-label="Grid"
            className={
              layout === "grid"
                ? "bg-secondary rounded px-2 py-1"
                : "text-muted-foreground rounded px-2 py-1"
            }
          >
            <LayoutGridIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground px-1 py-6 text-center text-sm">Nothing matches that.</p>
      ) : (
        GROUPS.map((group) => {
          const rows = shown.filter((account) => group.roles.includes(account.role));
          if (rows.length === 0) return null;

          return (
            <section key={group.key} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {group.title}
                <span className="text-faint font-normal"> · {rows.length}</span>
              </h3>

              {layout === "table" ? (
                <AccountTable rows={rows} open={open} onOpen={setOpen} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((account) => (
                    <AccountCard key={account.accountId} account={account} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

/** One line per account, opening to the checks behind it. */
function AccountTable({
  rows,
  open,
  onOpen,
}: {
  rows: DecidedAccount[];
  open: string | null;
  onOpen: (id: string | null) => void;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Account</TableHead>
            <TableHead>Checks</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead className="text-right">Last decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((account) => {
            const expanded = open === account.accountId;

            return [
              <TableRow key={account.accountId}>
                <TableCell className="align-top">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Hide" : "Show"} the checks for ${account.name}`}
                    onClick={() => onOpen(expanded ? null : account.accountId)}
                    className="hover:bg-secondary rounded p-1"
                  >
                    <ChevronDownIcon
                      className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                </TableCell>

                <TableCell className="align-top">
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-muted-foreground text-xs">
                      <span className="font-mono">{account.accountId}</span>
                      {account.district ? ` · ${account.district}` : ""}
                    </span>
                  </span>
                </TableCell>

                <TableCell className="align-top">
                  <Tally account={account} />
                </TableCell>

                <TableCell className="align-top">
                  {/* Every document this account ever sent, in one place, each
                      labelled with the check it belongs to. */}
                  <DocumentStrip
                    documents={account.documents}
                    label={account.name}
                    emptyNote="None"
                    grid
                  />
                </TableCell>

                <TableCell className="text-muted-foreground align-top text-right text-xs whitespace-nowrap">
                  {account.lastDecidedLabel}
                </TableCell>
              </TableRow>,

              expanded ? (
                <TableRow key={`${account.accountId}-detail`} className="hover:bg-transparent">
                  <TableCell colSpan={5} className="bg-secondary/40">
                    <CheckList checks={account.checks} />
                  </TableCell>
                </TableRow>
              ) : null,
            ];
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** The same record with the documents given room. */
function AccountCard({ account }: { account: DecidedAccount }) {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{account.name}</span>
          <span className="text-muted-foreground text-xs">
            <span className="font-mono">{account.accountId}</span>
            {account.district ? ` · ${account.district}` : ""}
          </span>
        </span>
        <span className="text-faint text-xs whitespace-nowrap">{account.lastDecidedLabel}</span>
      </div>

      <Tally account={account} />

      <DocumentStrip
        documents={account.documents}
        label={account.name}
        emptyNote="No documents were uploaded by this account."
        grid
      />

      <CheckList checks={account.checks} />
    </div>
  );
}

/** How the account's checks came out, without reading them one by one. */
function Tally({ account }: { account: DecidedAccount }) {
  return (
    <span className="flex flex-wrap gap-1">
      {account.approved > 0 ? (
        <Badge variant="outline" className="border-success/40 text-success">
          <BadgeCheckIcon className="size-3" />
          {account.approved} approved
        </Badge>
      ) : null}
      {account.refused > 0 ? (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          <XIcon className="size-3" />
          {account.refused} refused
        </Badge>
      ) : null}
      {account.waitingOnThem > 0 ? (
        <Badge variant="outline" className="border-warning/40 bg-warning-soft text-warning">
          <MessageSquareIcon className="size-3" />
          {account.waitingOnThem} with them
        </Badge>
      ) : null}
    </span>
  );
}

/** Each check, what was decided about it, and the conversation that led there. */
function CheckList({ checks }: { checks: DecidedCheck[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => {
        const decision = DECISION[check.state] ?? {
          label: check.state,
          className: "",
          Icon: BadgeCheckIcon,
        };

        return (
          <li key={check.kind} className="flex flex-col gap-1 border-l pl-3">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{CHECK_LABELS[check.kind]}</span>
              <Badge variant="outline" className={decision.className}>
                <decision.Icon className="size-3" />
                {decision.label}
              </Badge>
              {check.reference ? (
                <span className="text-muted-foreground font-mono text-xs">{check.reference}</span>
              ) : null}
            </span>

            <span className="text-faint text-xs">
              {decision.label.toLowerCase()} {check.decidedLabel}
              {check.operator ? ` by ${check.operator}` : ""}
            </span>

            {check.reason ? <p className="text-foreground text-sm">{check.reason}</p> : null}

            {check.notes.length > 0 ? (
              <ol className="flex flex-col gap-0.5">
                {check.notes.map((note, i) => (
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
          </li>
        );
      })}
    </ul>
  );
}
