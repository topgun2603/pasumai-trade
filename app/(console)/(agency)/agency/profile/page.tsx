import type { Metadata } from "next";
import { connection } from "next/server";

import { DocumentList, StatusBadge } from "@/components/admin/badges";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAgency } from "@/lib/auth/agency";
import { AGENCY_SERVICE_LABELS } from "@/lib/domain/admin";

export const metadata: Metadata = { title: "Agency · Agency" };

export default async function AgencyProfilePage() {
  await connection();

  const { agency, email } = await requireAgency();
  const now = new Date().getTime();

  const rows: Array<[string, React.ReactNode]> = [
    ["Agency", agency.name],
    ["Reference", <span key="id" className="font-mono">{agency.id}</span>],
    [
      "Contracted for",
      <span key="s" className="flex gap-1">
        {agency.services.map((s) => (
          <Badge key={s} variant="secondary">
            {AGENCY_SERVICE_LABELS[s]}
          </Badge>
        ))}
      </span>,
    ],
    ["Contact", `${agency.contactName} · ${agency.mobile}`],
    ["Sign-in", email ?? agency.email],
    ["Based", `${agency.town}, ${agency.district}`],
    ["Districts served", agency.districts.join(", ")],
  ];

  return (
    <>
      <PageHeader
        title="Your agency"
        description="Held by operations. Anything here that is wrong — a district you no longer serve, a contact who has left — is a phone call to change, not a form, because it decides what your crew can be sent to."
        aside={<StatusBadge status={agency.status} />}
      />

      <div className="flex max-w-3xl flex-col gap-6 p-6">
        <dl className="bg-card divide-border divide-y rounded-lg border">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3"
            >
              <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
              <dd className="min-w-0 flex-1 text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Your documents</h2>
          <p className="text-muted-foreground text-sm">
            These gate everything you register. If one lapses, every worker and
            vehicle on your books stops being dispatchable until it is renewed —
            and none of them is the reason.
          </p>
          <DocumentList documents={agency.documents} now={now} />
        </div>
      </div>
    </>
  );
}
