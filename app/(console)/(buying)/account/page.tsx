import {
  BadgeCheckIcon,
  CreditCardIcon,
  HistoryIcon,
  LandmarkIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AccountHub, type AccountRow } from "@/components/account/account-hub";
import { ProfilePhoto } from "@/components/account/profile-photo";
import { PageHeader } from "@/components/page-header";
import { BUYING_ROLES } from "@/lib/auth/claims";
import { requireConsole } from "@/lib/auth/require";
import { BANK_STATE_LABELS, bankState } from "@/lib/domain/bank";
import { kycState, KYC_LABELS } from "@/lib/domain/kyc";
import { effectiveStatus, SUBSCRIPTION_LABELS } from "@/lib/domain/subscription";
import { readChecks } from "@/lib/firebase/kyc-read";
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

  const [state, checks] = await Promise.all([
    readAccountState(role, accountId),
    readChecks(role, accountId),
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

      <div className="flex max-w-3xl flex-col gap-6 p-5">
        <div className="bg-card rounded-lg border p-4">
          <ProfilePhoto name={session.email ?? "Your account"} />
        </div>

        <AccountHub rows={rows} />
      </div>
    </>
  );
}
