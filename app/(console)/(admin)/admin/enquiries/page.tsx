import type { Metadata } from "next";
import { connection } from "next/server";

import { EnquiryQueue, type EnquiryRow } from "@/components/admin/enquiry-queue";
import { PageHeader } from "@/components/page-header";
import { requireConsole } from "@/lib/auth/require";
import { inWorkingOrder, isWaiting } from "@/lib/domain/enquiry";
import { readEnquiries } from "@/lib/firebase/enquiries";

export const metadata: Metadata = { title: "Enquiries · Admin" };

/**
 * People who asked to be called, from the landing page.
 *
 * Open first, oldest of those first — the same rule the KYC queue uses, and for
 * the same reason: a list sorted newest-first is how the person who has waited
 * longest goes on waiting.
 */
export default async function AdminEnquiriesPage() {
  await connection();
  await requireConsole(["admin"]);

  const enquiries = await readEnquiries();
  const now = new Date().getTime();

  const rows: EnquiryRow[] = inWorkingOrder(enquiries).map((enquiry) => ({
    id: enquiry.id,
    interest: enquiry.interest,
    name: enquiry.name,
    organisation: enquiry.organisation,
    mobile: enquiry.mobile,
    district: enquiry.district,
    message: enquiry.message,
    status: enquiry.status,
    // Formatted on the server so the server and client renders agree, and the
    // raw stamp beside it so the column sorts by age rather than by wording.
    askedLabel: relative(now - enquiry.createdAt.getTime()),
    askedAt: enquiry.createdAt.getTime(),
    notes: (enquiry.notes ?? []).map((note) => ({
      at: relative(now - note.at.getTime()),
      operator: note.operator,
      status: note.status,
      message: note.message,
    })),
  }));

  const waiting = enquiries.filter((enquiry) => isWaiting(enquiry.status)).length;

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="People who asked to be called from the landing page. Nobody self-registers, so this is where an account begins."
        aside={
          <p className="text-faint text-xs">
            {waiting} to call · {enquiries.length} total
          </p>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <EnquiryQueue rows={rows} />
      </div>
    </>
  );
}

/** Coarse on purpose: "3 days ago" is the useful precision in a queue. */
function relative(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
