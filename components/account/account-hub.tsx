import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The Profile area, as a list of what the platform holds about somebody.
 *
 * ## The complaint this answers
 *
 * Bug 17: verification, KYC, subscription, bank and account details were
 * sidebar siblings of the operational pages, so "am I set up" was a question
 * you answered by visiting four places and remembering what each said. Bug 18
 * adds that the labels were ambiguous and there was no structured view.
 *
 * So: one page per role, one row per thing, and each row carries its own state
 * rather than making somebody open it to find out. The state is the point — a
 * person opens this page to learn what is missing, and a list of links with no
 * status makes them click all four to discover that none of them are.
 *
 * ## Why a shared component and per-role pages
 *
 * The four consoles have different layouts and different sub-pages, but the
 * question is identical in all of them. This holds the shape; each console
 * passes its own rows and keeps its own sidebar.
 */

export type RowTone = "done" | "waiting" | "action" | "neutral";

const TONE: Record<RowTone, string> = {
  done: "border-success/40 bg-success-soft text-success",
  waiting: "border-warning/40 bg-warning-soft text-warning",
  action: "border-destructive/40 bg-destructive-soft text-destructive",
  neutral: "border-border text-muted-foreground",
};

export interface AccountRow {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
  /** One line saying what lives behind it, in the reader's own terms. */
  readonly summary: string;
  /** What it says on the right. Absent where there is no state to report. */
  readonly state?: string;
  readonly tone?: RowTone;
}

export function AccountHub({ rows }: { rows: readonly AccountRow[] }) {
  return (
    <ul className="divide-border bg-card divide-y overflow-hidden rounded-lg border">
      {rows.map(({ href, icon: Icon, label, summary, state, tone = "neutral" }) => (
        <li key={href}>
          <Link
            href={href}
            className="hover:bg-secondary/60 focus-visible:ring-ring flex items-center gap-3.5 px-4 py-3.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2"
          >
            <Icon className="text-muted-foreground size-5 shrink-0" />

            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-muted-foreground text-xs">{summary}</span>
            </span>

            {state ? (
              <Badge variant="outline" className={cn("shrink-0", TONE[tone])}>
                {state}
              </Badge>
            ) : null}

            <ChevronRightIcon className="text-faint size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
