"use client";

import { BadgeCheckIcon, MessageSquareIcon, UploadIcon, XIcon } from "lucide-react";

import { ACCOUNT_GROUPS } from "@/components/admin/kyc-groups";
import { DataTable, type Column, type FilterTab } from "@/components/data-table";
import { DocumentStrip, type ViewableDocument } from "@/components/kyc/documents";
import { Badge } from "@/components/ui/badge";
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
  /** The account id again, under the name the data grid keys rows by. */
  readonly id: string;
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

export function KycHistory({ accounts }: { accounts: DecidedAccount[] }) {
  const columns: Column<DecidedAccount>[] = [
    {
      key: "name",
      header: "Account",
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground text-xs">
            <span className="font-mono">{row.accountId}</span>
            {row.district ? ` · ${row.district}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "checks",
      header: "Checks",
      // Sorted by how much was approved, which is the question somebody
      // scanning this column is actually asking.
      sortValue: (row) => row.approved,
      cell: (row) => <Tally account={row} />,
    },
    {
      key: "documents",
      header: "Documents",
      sortValue: (row) => row.documents.length,
      cell: (row) => (
        <DocumentStrip documents={row.documents} label={row.name} emptyNote="None" grid />
      ),
    },
    {
      key: "decided",
      header: "Last decision",
      // The timestamp, not the label: "3 days ago" and "just now" sort
      // alphabetically into nonsense.
      sortValue: (row) => row.lastDecidedAt,
      cell: (row) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {row.lastDecidedLabel}
        </span>
      ),
    },
  ];

  const tabs: FilterTab<DecidedAccount>[] = [
    { value: "all", label: "All" },
    { value: "verified", label: "Approved", match: (row) => row.approved > 0 },
    { value: "failed", label: "Refused", match: (row) => row.refused > 0 },
    { value: "pendingThem", label: "Waiting on them", match: (row) => row.waitingOnThem > 0 },
  ];

  /*
    A table per kind of account rather than one with a "kind" column.

    Operations do not review a farmer and a transport agency alike — a farmer
    clears two checks and an agency five — and a single sortable column asks
    the reader to re-sort every time they change what they are doing. Each
    section gets its own sorting, filtering and paging, which is the point:
    working through farmers should not move the page you are on for agencies.
  */
  return (
    <div className="flex flex-col gap-6">
      {ACCOUNT_GROUPS.map((group) => {
        const rows = accounts.filter((account) => group.roles.includes(account.role));
        if (rows.length === 0) return null;

        return (
          <section key={group.key} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {group.title}
              <span className="text-faint font-normal"> · {rows.length}</span>
            </h3>

            <DataTable
              rows={rows}
              columns={columns}
              tabs={tabs}
              entityLabel="accounts"
              searchPlaceholder="Name, account id or district"
              // Name, id and district, because an operator looking something up
              // has one of the three and rarely the same one twice.
              searchText={(row) => `${row.name} ${row.accountId} ${row.district}`}
              expand={(row) => <CheckList checks={row.checks} />}
              card={(row) => <AccountCard account={row} />}
              initialPageSize={10}
            />
          </section>
        );
      })}

      {accounts.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Nothing has been decided yet. Approvals and refusals are kept here with the documents
          they were made on.
        </div>
      ) : null}
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
