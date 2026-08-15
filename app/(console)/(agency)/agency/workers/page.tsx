import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ManpowerTable } from "@/components/admin/manpower-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireService } from "@/lib/auth/agency";
import { workers } from "@/lib/mock/admin";

export const metadata: Metadata = { title: "Workers · Agency" };

export default async function AgencyWorkersPage() {
  await connection();

  const { agency } = await requireService("manpower");
  const now = new Date();

  // Scoped by the session's agency id, never by anything in the request.
  const crew = workers(now).filter((w) => w.agencyId === agency.id);

  return (
    <>
      <PageHeader
        title="Workers"
        description="Your crew. You enter them; operations verifies them. Anyone not yet verified can be listed but not sent on a job."
        aside={
          <Button asChild>
            <Link href="/agency/workers/new">
              <PlusIcon className="size-4" />
              Add worker
            </Link>
          </Button>
        }
      />
      <ManpowerTable crew={crew} now={now.getTime()} />
    </>
  );
}
