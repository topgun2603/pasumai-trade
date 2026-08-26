import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdManager } from "@/components/admin/ad-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { verifySession } from "@/lib/auth/session";
import { readAds, withSignedImage } from "@/lib/firebase/ads-read";

export const metadata: Metadata = { title: "Advertising · Admin" };

export default async function AdsPage() {
  await connection();

  // Read once, outside the render expression, so "live" and "ended" mean the
  // same thing on the server and after hydration.
  const now = new Date().getTime();

  const [{ ads, live }, session] = await Promise.all([readAds(), verifySession()]);

  // Every creative, not just the chosen ones — this screen shows the whole
  // book and the edit dialog needs a loadable image for each. An ad book is a
  // few dozen rows at most, so signing all of them is cheap here in a way it
  // would not be on a public page.
  const withImages = await Promise.all(ads.map(withSignedImage));

  // Same rule the endpoints enforce, so a button cannot offer what a save
  // would refuse.
  const editable = live && session?.claims.role === "admin";

  return (
    <>
      <AdminPageHeader
        title="Advertising"
        description="Every place the product can show a paid placement, and what is in each one. Booking here changes the live site — no deploy, no developer."
      />

      <div className="flex flex-col gap-8 p-6">
        {editable ? null : (
          <div className="border-warning/40 bg-warning-soft text-warning flex items-start gap-3 rounded-lg border p-4">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Read only</span>
              <span className="text-foreground/80">
                {live
                  ? "Only operations can book a placement."
                  : "No Admin credentials, so there is no ad book to read. Set the service account to manage placements."}
              </span>
            </div>
          </div>
        )}

        <AdManager ads={withImages} now={now} editable={editable} />
      </div>
    </>
  );
}
