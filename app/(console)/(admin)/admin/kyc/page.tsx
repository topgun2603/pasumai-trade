import type { Metadata } from "next";
import { connection } from "next/server";

import { KycQueue, type QueueRow } from "@/components/admin/kyc-queue";
import { PageHeader } from "@/components/page-header";
import { requireConsole } from "@/lib/auth/require";
import { readReviewQueue } from "@/lib/firebase/kyc-read";

export const metadata: Metadata = { title: "KYC review · Admin" };

/**
 * The manual queue, oldest first.
 *
 * Only manual submissions appear here. An eKYC result has already been settled
 * by an issuing authority, and putting it in front of an operator would invite
 * them to overrule UIDAI — which the domain refuses anyway.
 */
export default async function AdminKycPage() {
  await connection();
  await requireConsole(["admin"]);

  const queue = await readReviewQueue();
  const now = new Date().getTime();

  const rows: QueueRow[] = queue.map((entry) => ({
    accountId: entry.accountId,
    role: entry.role,
    name: entry.name,
    mobile: entry.mobile,
    district: entry.district,
    waiting: entry.checks
      .filter((c) => c.state === "review")
      .map((c) => ({
        kind: c.kind,
        reference: c.reference,
        // Formatted on the server so the server and client renders agree.
        submittedLabel: c.checkedAt ? relative(now - c.checkedAt.getTime()) : undefined,
      })),
  }));

  const waiting = rows.reduce((n, r) => n + r.waiting.length, 0);

  return (
    <>
      <PageHeader
        title="KYC review"
        description="Manual submissions waiting on a decision. Instant eKYC results never appear here — they are already settled."
        aside={
          <p className="text-faint text-xs">
            {rows.length} account{rows.length === 1 ? "" : "s"} · {waiting} check
            {waiting === 1 ? "" : "s"}
          </p>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <KycQueue rows={rows} />
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
