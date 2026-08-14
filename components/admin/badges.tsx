import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_LABELS,
  daysUntilExpiry,
  expiryState,
  VERIFICATION_LABELS,
  worstExpiry,
  type ComplianceDocument,
  type ExpiryState,
  type VerificationStatus,
} from "@/lib/domain/admin";
import { cn } from "@/lib/utils";

const VERIFICATION_STYLE: Record<VerificationStatus, string> = {
  verified: "border-success/40 bg-success-soft text-success",
  pending: "border-warning/40 bg-warning-soft text-warning",
  rejected: "border-destructive/40 bg-destructive-soft text-destructive",
  suspended: "border-destructive/40 bg-destructive-soft text-destructive",
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  return (
    <Badge variant="outline" className={cn("shrink-0", VERIFICATION_STYLE[status])}>
      {VERIFICATION_LABELS[status]}
    </Badge>
  );
}

const EXPIRY_STYLE: Record<ExpiryState, string> = {
  valid: "border-success/40 bg-success-soft text-success",
  expiringSoon: "border-warning/40 bg-warning-soft text-warning",
  expired: "border-destructive/40 bg-destructive-soft text-destructive",
  noExpiry: "border-border bg-secondary text-muted-foreground",
};

/**
 * Compliance across a set of documents, summarised to its worst member.
 *
 * A vehicle with valid insurance and a lapsed fitness certificate is not
 * partly compliant — it is off the road. The badge says so.
 */
export function ComplianceBadge({
  documents,
  now,
}: {
  documents: readonly ComplianceDocument[];
  now: number;
}) {
  if (documents.length === 0) {
    return (
      <Badge variant="outline" className={EXPIRY_STYLE.expired}>
        No documents
      </Badge>
    );
  }

  const state = worstExpiry(documents, now);

  if (state === "expired") {
    const lapsed = documents.filter((d) => expiryState(d, now) === "expired");
    return (
      <Badge variant="outline" className={EXPIRY_STYLE.expired}>
        {lapsed.map((d) => DOCUMENT_LABELS[d.kind]).join(", ")} expired
      </Badge>
    );
  }

  if (state === "expiringSoon") {
    const soon = documents
      .filter((d) => expiryState(d, now) === "expiringSoon")
      .sort(
        (a, b) => (daysUntilExpiry(a, now) ?? 0) - (daysUntilExpiry(b, now) ?? 0),
      );
    const first = soon[0];
    return (
      <Badge variant="outline" className={EXPIRY_STYLE.expiringSoon}>
        {DOCUMENT_LABELS[first.kind]} in {daysUntilExpiry(first, now)}d
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={EXPIRY_STYLE.valid}>
      All valid
    </Badge>
  );
}

/** Compact list of every document on a record, for a detail row. */
export function DocumentList({
  documents,
  now,
}: {
  documents: readonly ComplianceDocument[];
  now: number;
}) {
  if (documents.length === 0) {
    return <span className="text-faint text-xs">None submitted</span>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {documents.map((d) => {
        const state = expiryState(d, now);
        const days = daysUntilExpiry(d, now);
        return (
          <li key={`${d.kind}-${d.reference}`}>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
                EXPIRY_STYLE[state],
              )}
            >
              <span className="font-medium">{DOCUMENT_LABELS[d.kind]}</span>
              {days !== null ? (
                <span className="tabular opacity-80">
                  {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                </span>
              ) : null}
              {!d.verifiedAt ? <span className="opacity-80">· unchecked</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
