import type { Metadata } from "next";
import { connection } from "next/server";

import { KycHistory, type DecidedAccount } from "@/components/admin/kyc-history";
import { KycQueue, type QueueRow } from "@/components/admin/kyc-queue";
import type { ViewableDocument } from "@/components/kyc/documents";
import { PageHeader } from "@/components/page-header";
import { requireConsole } from "@/lib/auth/require";
import { CHECK_LABELS, type Check } from "@/lib/domain/kyc";
import { readKycAccounts, signDocuments } from "@/lib/firebase/kyc-read";

export const metadata: Metadata = { title: "KYC review · Admin" };

/**
 * The manual queue, and the record of everything already decided.
 *
 * Only manual submissions appear here. An eKYC result has already been settled
 * by an issuing authority, and putting it in front of an operator would invite
 * them to overrule UIDAI — which the domain refuses anyway.
 *
 * Both halves are keyed by the **account**, not by the check. A verification is
 * a judgement about a farmer or a firm; the checks are how it is reached. The
 * first version of this listed each decided check separately, so one farmer
 * appeared three times with a third of their documents each and no row that was
 * recognisably them.
 *
 * Both are built from one scan of the three account collections. The page used
 * to read them and throw away everything that was not waiting, which is why
 * there was no history: the data was loaded and discarded.
 *
 * Every document is signed here, on the server, for fifteen minutes. The
 * browser never holds a storage credential and the URLs in the HTML are stale
 * by the time a page left open overnight could be scraped from it.
 */
export default async function AdminKycPage() {
  await connection();
  await requireConsole(["admin"]);

  const accounts = await readKycAccounts();
  const now = new Date().getTime();

  /*
    Signed once per check and gathered per account. A check moves from the queue
    to the history the moment it is decided, and signing it twice would be two
    sets of URLs for the same photograph.
  */
  const signed = new Map<string, ViewableDocument[]>();
  await Promise.all(
    accounts.flatMap((entry) =>
      entry.checks
        .filter((check) => (check.documents?.length ?? 0) > 0)
        .map(async (check) => {
          const documents = await signDocuments(check.documents);
          signed.set(
            `${entry.accountId}:${check.kind}`,
            documents.map((document) => ({
              url: document.url,
              contentType: document.contentType,
              uploadedLabel: relative(now - document.uploadedAt.getTime()),
              // Which check this is evidence for. Once an account's documents
              // share one tile, an uncaptioned photograph is one nobody can act
              // on.
              caption: CHECK_LABELS[check.kind],
              uploadedAt: document.uploadedAt.getTime(),
            })),
          );
        }),
    ),
  );

  /** Everything one account uploaded, newest first, whatever check it was for. */
  const documentsFor = (accountId: string, checks: readonly Check[]): ViewableDocument[] =>
    checks
      .flatMap((check) => signed.get(`${accountId}:${check.kind}`) ?? [])
      .sort((a, b) => b.uploadedAt - a.uploadedAt);

  const trail = (check: Check) =>
    (check.notes ?? []).map((note) => ({
      by: note.by,
      state: note.state,
      message: note.message,
      at: relative(now - note.at.getTime()),
    }));

  const rows: QueueRow[] = accounts
    .filter((entry) => entry.checks.some((check) => check.state === "review"))
    .map((entry) => ({
      accountId: entry.accountId,
      role: entry.role,
      name: entry.name,
      mobile: entry.mobile,
      district: entry.district,
      // Everything they have ever sent, not only what is waiting. An operator
      // deciding on the bank proof frequently needs the identity document that
      // was approved last week to compare the name against.
      documents: documentsFor(entry.accountId, entry.checks),
      waiting: entry.checks
        .filter((check) => check.state === "review")
        .map((check) => ({
          kind: check.kind,
          reference: check.reference,
          // Formatted on the server so the server and client renders agree.
          submittedLabel: check.checkedAt ? relative(now - check.checkedAt.getTime()) : undefined,
          // What has already been said. An account on its third pass through the
          // queue looks identical to a first submission without it.
          notes: trail(check),
        })),
    }));

  /*
    Everything an operator has already ruled on, one record per account, newest
    decision first. `moreInfo` and `reupload` are decisions too — somebody was
    asked something and is now the one being waited on, which is exactly the
    state an operator loses track of if it is filed under neither queue nor
    history.
  */
  const DECIDED = ["verified", "failed", "moreInfo", "reupload"] as const;
  const isDecided = (check: Check) =>
    check.method === "manual" && (DECIDED as readonly string[]).includes(check.state);

  const decided: DecidedAccount[] = accounts
    .flatMap((entry) => {
      const checks = entry.checks.filter(isDecided);
      if (checks.length === 0) return [];

      const decidedTimes = checks.map((check) => check.checkedAt?.getTime() ?? 0);
      const lastDecidedAt = Math.max(...decidedTimes);

      return [
        {
          id: entry.accountId,
          accountId: entry.accountId,
          role: entry.role,
          name: entry.name,
          district: entry.district,
          mobile: entry.mobile,
          documents: documentsFor(entry.accountId, entry.checks),
          lastDecidedAt,
          lastDecidedLabel: lastDecidedAt > 0 ? relative(now - lastDecidedAt) : "at some point",
          approved: checks.filter((check) => check.state === "verified").length,
          refused: checks.filter((check) => check.state === "failed").length,
          waitingOnThem: checks.filter(
            (check) => check.state === "moreInfo" || check.state === "reupload",
          ).length,
          checks: checks
            .map((check) => ({
              kind: check.kind,
              state: check.state,
              reference: check.reference,
              operator: check.approvedBy,
              decidedLabel: check.checkedAt
                ? relative(now - check.checkedAt.getTime())
                : "at some point",
              reason: check.reason,
              notes: trail(check),
            }))
            .sort((a, b) => a.kind.localeCompare(b.kind)),
        },
      ];
    })
    .sort((a, b) => b.lastDecidedAt - a.lastDecidedAt);

  const waiting = rows.reduce((n, r) => n + r.waiting.length, 0);
  const approved = decided.reduce((n, entry) => n + entry.approved, 0);

  return (
    <>
      <PageHeader
        title="KYC review"
        description="Manual submissions waiting on a decision, and the record of everything already decided. Instant eKYC results never appear here — they are already settled."
        aside={
          <p className="text-faint text-xs">
            {waiting} waiting · {approved} approved
          </p>
        }
      />

      <div className="flex flex-col gap-8 p-5">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">Waiting on us</h2>
            <p className="text-faint text-xs">
              {rows.length} account{rows.length === 1 ? "" : "s"} · {waiting} check
              {waiting === 1 ? "" : "s"}
            </p>
          </div>
          <KycQueue rows={rows} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">Already decided</h2>
            <p className="text-faint text-xs">
              {decided.length} account{decided.length === 1 ? "" : "s"}, newest decision first
            </p>
          </div>
          <KycHistory accounts={decided} />
        </section>
      </div>
    </>
  );
}

/** Coarse on purpose: "3 days ago" is the useful precision in a review queue. */
function relative(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
