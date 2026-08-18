import type { Metadata } from "next";
import { connection } from "next/server";

import { OpsFeed, type FeedRow } from "@/components/admin/ops-feed";
import { PageHeader } from "@/components/page-header";
import { requireConsole } from "@/lib/auth/require";
import { isWaiting } from "@/lib/domain/enquiry";
import { CHECK_LABELS } from "@/lib/domain/kyc";
import { inAttentionOrder, isOverdue, type OpsItem } from "@/lib/domain/ops-feed";
import { readEnquiries } from "@/lib/firebase/enquiries";
import { readKycAccounts } from "@/lib/firebase/kyc-read";

export const metadata: Metadata = { title: "Notifications · Admin" };

/**
 * What is waiting on operations.
 *
 * Derived from the queues rather than written alongside them. Nothing has to be
 * written when a check is approved for it to leave this list — it leaves
 * because it is no longer waiting, which is the only definition that cannot
 * drift.
 *
 * The two reads are the same ones the enquiries and KYC pages already make. At
 * this scale that is cheaper than maintaining a third collection, and it is
 * always right.
 */
export default async function AdminNotificationsPage() {
  await connection();
  await requireConsole(["admin"]);

  const [enquiries, kyc] = await Promise.all([readEnquiries(), readKycAccounts()]);
  const now = new Date().getTime();

  const items: OpsItem[] = [
    ...enquiries.filter((enquiry) => isWaiting(enquiry.status)).map(
      (enquiry): OpsItem => ({
        id: `enquiry:${enquiry.id}`,
        kind: "enquiry",
        title: enquiry.name,
        detail: `${enquiry.interest === "farmer" ? "Wants to sell" : "Wants to buy"} · ${enquiry.district} · ${enquiry.mobile}`,
        since: enquiry.createdAt.getTime(),
        href: "/admin/enquiries",
      }),
    ),

    ...kyc.flatMap((account) =>
      account.checks.flatMap((check): OpsItem[] => {
        // Submitted and waiting on us.
        if (check.state === "review") {
          return [
            {
              id: `kyc:${account.accountId}:${check.kind}`,
              kind: "kyc",
              title: account.name,
              detail: `${CHECK_LABELS[check.kind]} · ${account.role}${account.district ? ` · ${account.district}` : ""}`,
              since: check.checkedAt?.getTime() ?? now,
              href: "/admin/kyc",
            },
          ];
        }

        /*
          Asked a question and heard nothing back. Not work an operator does,
          but work an operator chases — and the state most easily lost, because
          it sits in neither queue: operations are not waiting on themselves,
          and the applicant may have forgotten they were asked.
        */
        if (check.state === "moreInfo" || check.state === "reupload") {
          return [
            {
              id: `chase:${account.accountId}:${check.kind}`,
              kind: "reupload",
              title: account.name,
              detail: `${CHECK_LABELS[check.kind]} — ${check.state === "reupload" ? "sent back" : "asked"}, no reply`,
              since: check.checkedAt?.getTime() ?? now,
              href: "/admin/kyc",
            },
          ];
        }

        return [];
      }),
    ),
  ];

  const ordered = inAttentionOrder(items, now);

  const rows: FeedRow[] = ordered.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    href: item.href,
    // Formatted on the server so the server and client renders agree.
    waitingLabel: relative(now - item.since),
    since: item.since,
    overdue: isOverdue(item, now),
  }));

  const overdue = rows.filter((row) => row.overdue).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything waiting on operations, oldest first. Read from the queues themselves, so nothing appears here that has already been dealt with."
        aside={
          <p className="text-faint text-xs">
            {rows.length} waiting{overdue > 0 ? ` · ${overdue} overdue` : ""}
          </p>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <OpsFeed rows={rows} />
      </div>
    </>
  );
}

/** Coarse on purpose: "3 days ago" is the useful precision in a queue. */
function relative(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
