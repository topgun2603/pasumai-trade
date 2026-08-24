import {
  BadgeCheckIcon,
  CreditCardIcon,
  HistoryIcon,
  LandmarkIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { DocumentList, StatusBadge } from "@/components/admin/badges";
import { AccountHub, type AccountRow } from "@/components/account/account-hub";
import { ProfilePhoto } from "@/components/account/profile-photo";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { BANK_STATE_LABELS, bankState } from "@/lib/domain/bank";
import { kycState, KYC_LABELS } from "@/lib/domain/kyc";
import { effectiveStatus, SUBSCRIPTION_LABELS } from "@/lib/domain/subscription";
import { readChecks } from "@/lib/firebase/kyc-read";
import { readBuyingAccount } from "@/lib/firebase/roster-read";
import { readAccountState } from "@/lib/firebase/subscription-read";

export const metadata: Metadata = { title: "Account" };

/**
 * Everything the platform holds about a buyer, in one place.
 *
 * The buying console had no account page at all — verification and
 * subscription were sidebar items and nothing tied them together, which is
 * most of what Bugs 17 and 21 are describing.
 */
export default async function BuyingAccountPage() {
  await connection();

  const session = await requireConsole([...BUYING_ROLES, "admin"]);
  const { role, accountId } = session.claims;
  const now = new Date();
  const clock = now.getTime();

  const [state, checks, account] = await Promise.all([
    readAccountState(role, accountId),
    readChecks(role, accountId),
    readBuyingAccount(role, accountId),
  ]);

  const standing = effectiveStatus(state.subscription, now);
  const documents = kycState(checks, role);
  /*
    Nothing writes buyer bank details yet, so this reads as "Not provided" and
    the row is the invitation to add them. Wiring the form is the next piece;
    the rule that decides when it counts as done is already in `lib/domain/bank`
    and tested, which is the half Bug 18 was actually about.
  */
  const bank = bankState({});

  const rows: AccountRow[] = [
    {
      href: "/account/verification",
      icon: BadgeCheckIcon,
      label: "Verification",
      summary: "The documents that let you trade",
      state: KYC_LABELS[documents],
      tone:
        documents === "verified"
          ? "done"
          : documents === "awaitingApproval"
            ? "waiting"
            : "action",
    },
    {
      href: "/account/bank",
      icon: LandmarkIcon,
      label: "Bank details",
      summary: "Where money is sent and taken from",
      state: BANK_STATE_LABELS[bank],
      tone: bank === "complete" ? "done" : bank === "empty" ? "neutral" : "action",
    },
    {
      href: "/account/subscription",
      icon: CreditCardIcon,
      label: "Subscription",
      summary: "Bargaining and ordering need an active plan",
      state: standing === "none" ? "None" : SUBSCRIPTION_LABELS[standing],
      tone: standing === "active" || standing === "trialing" ? "done" : "action",
    },
    {
      href: "/account/history",
      icon: HistoryIcon,
      label: "History",
      summary: "Every change to your orders and your account",
    },
  ];

  return (
    <>
      <PageHeader
        title="My Profile"
        description="What the platform holds about you, and what is still needed."
      />

      <div className="flex flex-col gap-6 p-5">
        <div className="bg-card rounded-lg border p-4">
          <ProfilePhoto
            name={account?.name ?? session.email ?? "Your account"}
            photoUrl={account?.photoUrl}
          />
        </div>

        <AccountHub rows={rows} />

        {/*
          What the platform holds, spelled out — the same table the farm and
          agency profiles carry. The rows above say what still needs doing;
          this says what is on file, which is the other half of the question
          somebody opens this page with.
        */}
        {account ? (
          <>
            <dl className="border-border divide-border bg-card divide-y rounded-lg border">
              {(
                [
                  ["Name", account.name],
                  [
                    "Reference",
                    <span key="id" className="font-mono">
                      {account.id}
                    </span>,
                  ],
                  ["Contact", account.contactName || "—"],
                  ["Based", [account.town, account.district].filter(Boolean).join(", ") || "—"],
                  ["Mobile", account.mobile || "—"],
                  ["Sign-in", session.email ?? "—"],
                  ["Verification", <StatusBadge key="s" status={account.status} />],
                  ["Orders placed", account.ordersPlaced],
                ] as Array<[string, React.ReactNode]>
              ).map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheckIcon className="size-4" />
                Documents
              </h2>
              {account.documents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nothing on file yet. Operations will ask for your registration and a
                  bank proof when they verify you.
                </p>
              ) : (
                <DocumentList documents={account.documents} now={clock} />
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
