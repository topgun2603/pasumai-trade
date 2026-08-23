import {
  BadgeCheckIcon,
  CreditCardIcon,
  LandmarkIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { DocumentList, StatusBadge } from "@/components/admin/badges";
import { AccountHub, type AccountRow } from "@/components/account/account-hub";
import { ProfilePhoto } from "@/components/account/profile-photo";
import { PageHeader } from "@/components/page-header";
import { requireFarmer } from "@/lib/auth/farm";

export const metadata: Metadata = { title: "Account · Farmer" };

export default async function FarmAccountPage() {
  await connection();

  const { farmer, email } = await requireFarmer();
  const now = new Date().getTime();

  /*
    The three things that decide whether a farmer can actually sell, each
    saying where it stands. Read off the farmer record rather than from three
    further round trips: the status and the bank tail are already here.
  */
  const hubRows: AccountRow[] = [
    {
      href: "/farm/account/verification",
      icon: BadgeCheckIcon,
      label: "Verification",
      summary: "Your documents, checked once",
      state: farmer.status === "verified" ? "Verified" : "Not yet",
      tone: farmer.status === "verified" ? "done" : "action",
    },
    {
      href: "/farm/account/bank",
      icon: LandmarkIcon,
      label: "Bank details",
      summary: "Where your money is sent",
      state: farmer.bankAccountTail ? "On file" : "Not provided",
      tone: farmer.bankAccountTail ? "done" : "action",
    },
    {
      href: "/farm/account/subscription",
      icon: CreditCardIcon,
      label: "Subscription",
      summary: "Listing produce needs an active plan",
    },
  ];

  const rows: Array<[string, React.ReactNode]> = [
    ["Name", farmer.name],
    ["Reference", <span key="id" className="font-mono">{farmer.id}</span>],
    ["Village", `${farmer.village}, ${farmer.district}`],
    ["Mobile", farmer.mobile],
    ["Sign-in", email ?? "—"],
    [
      // Only the tail is stored anywhere, and only the tail is shown. A full
      // account number on a screen in a field is a full account number over
      // anyone's shoulder.
      "Bank account",
      farmer.bankAccountTail ? `•••• ${farmer.bankAccountTail}` : "Not added yet",
    ],
    ["Verification", <StatusBadge key="s" status={farmer.status} />],
    ["Completed orders", farmer.completedOrders],
  ];

  return (
    <>
      <PageHeader
        title="Account"
        description="What the platform holds about you. Ask operations to change anything here."
      />

      <div className="flex flex-col gap-6 p-5">
        {/* Theirs to change, unlike everything in the list below it — which is
          held by operations and says so. */}
        <div className="bg-card rounded-lg border p-4">
          <ProfilePhoto name={farmer.name} photoUrl={farmer.photoUrl} />
        </div>

        {/*
          Bug 17: Verification and Subscription used to be rail items of their
          own, so "am I set up to sell" meant visiting three screens and
          remembering what each said. They are here now, each carrying its own
          state, because the reason somebody opens this page is to find out
          what is missing.
        */}
        <AccountHub rows={hubRows} />

        <dl className="border-border divide-border bg-card divide-y rounded-lg border">
          {rows.map(([label, value]) => (
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
          {farmer.documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing on file yet. Operations will ask for your bank passbook and a land record
              when they verify you.
            </p>
          ) : (
            <DocumentList documents={farmer.documents} now={now} />
          )}
        </section>
      </div>
    </>
  );
}
