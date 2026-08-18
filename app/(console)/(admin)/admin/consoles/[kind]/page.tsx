import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AccountDirectory, type DirectoryRow } from "@/components/admin/account-directory";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireConsole } from "@/lib/auth/require";
import { CONSOLES, isConsoleKind } from "@/lib/domain/console-kinds";
import { describePlan } from "@/lib/domain/subscription";
import { readAccountsOfKind } from "@/lib/firebase/dossier-read";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  if (!isConsoleKind(kind)) return {};
  return { title: `${CONSOLES[kind].label} · Admin` };
}

/**
 * Find one account of a kind.
 *
 * The way in to a client's records: search, pick, open. Search is the point —
 * an operator arrives from a telephone call holding a name, an account id or a
 * mobile number, and rarely the same one twice.
 */
export default async function ConsoleDirectoryPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  /*
    Checked first, though that is not enough on its own.

    The admin layout above this page authenticates and reads counts for the
    rail, so the response has already begun streaming by the time any page runs
    — which means `notFound()` here renders the 404 page under a **200**. The
    reader sees the right thing; a monitor reading status codes does not.

    Fixing it properly means the layout not doing IO before its children, which
    is a larger change than this route should make on its own. Validating early
    is still right: it keeps the work off an unknown route.
  */
  const { kind } = await params;
  if (!isConsoleKind(kind)) notFound();

  await connection();
  await requireConsole(["admin"]);

  const definition = CONSOLES[kind];
  const accounts = await readAccountsOfKind(kind);
  const now = new Date().getTime();

  const rows: DirectoryRow[] = accounts
    .map((account) => ({
      id: account.id,
      accountId: account.id,
      name: account.name,
      mobile: account.mobile,
      where: [account.place, account.district].filter(Boolean).join(", "),
      status: account.status,
      planLabel: account.plan ? describePlan(account.plan).title : undefined,
      planStatus: account.planStatus,
      // Formatted on the server so the server and client renders agree.
      joinedLabel: account.registeredAt ? relative(now - account.registeredAt.getTime()) : "—",
      joinedAt: account.registeredAt?.getTime() ?? 0,
    }))
    .sort((a, b) => b.joinedAt - a.joinedAt);

  return (
    <>
      <AdminPageHeader
        title={definition.label}
        description={`${definition.blurb} Open an account to see everything the platform knows about it.`}
        aside={
          <p className="text-faint text-xs">
            {rows.length} account{rows.length === 1 ? "" : "s"}
          </p>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <AccountDirectory rows={rows} kind={kind} one={definition.one} />
      </div>
    </>
  );
}

/** Coarse on purpose: how long ago somebody joined is a matter of weeks. */
function relative(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
