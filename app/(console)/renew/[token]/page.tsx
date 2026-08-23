import { AlertTriangleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { verifySession } from "@/lib/auth/session";
import { readRenewalToken, renewalDestination } from "@/lib/domain/renewal-link";

export const metadata: Metadata = {
  title: "Renew your plan",
  robots: { index: false },
};

/**
 * Where the renewal SMS lands.
 *
 * The token names an account and nothing else — it is not a sign-in, and this
 * page is careful never to behave like one. See `lib/domain/renewal-link.ts`
 * for why an authenticating link is the wrong thing to put in a text message.
 *
 * Three outcomes:
 *
 *  - **Signed in as that account.** Straight to their renewal page. This is
 *    the ordinary case and costs one redirect.
 *  - **Not signed in.** Sent to sign in, carrying the destination, so they
 *    arrive where the message was sending them.
 *  - **Signed in as somebody else.** Said out loud rather than silently
 *    renewing the wrong subscription. A shared handset is normal here.
 *
 * A bad or stale token is a page, not a redirect, because the person tapped
 * something we sent them and "not found" would read as the platform losing
 * their account.
 */
export default async function RenewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await connection();

  const secret = process.env.CRON_SECRET;

  // Read once, after `connection()`, so the clock is not consulted inside the
  // render expression itself.
  const now = new Date().getTime();

  // The links are signed with the same secret the sending job runs under. With
  // none set nothing could have been signed, so nothing can be honoured.
  const check = secret
    ? readRenewalToken(decodeURIComponent(token), secret, now)
    : ({ ok: false, reason: "badSignature" } as const);

  if (check.ok) {
    const destination = renewalDestination(check.claim.collection);
    const session = await verifySession();

    if (!session) {
      redirect(`/en/signin?next=${encodeURIComponent(destination)}`);
    }

    if (session.claims.accountId === check.claim.accountId) {
      redirect(destination);
    }

    // Signed in as a different account. Fall through and say so.
  }

  const mismatch = check.ok;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <span className="flex items-center gap-2.5">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <BrandMark className="size-5" />
        </span>
        <span className="text-sm font-semibold">Pasumai Trade</span>
      </span>

      <div className="border-border bg-card flex max-w-md flex-col gap-3 rounded-lg border p-5 text-center">
        <span className="text-warning flex items-center justify-center gap-2 text-sm font-medium">
          <AlertTriangleIcon className="size-4" />
          {mismatch ? "That link is for another account" : "This link has expired"}
        </span>

        <p className="text-muted-foreground text-sm">
          {mismatch
            ? "You are signed in as somebody else. Sign out and back in as the account the message was sent to, and the link will work."
            : "Renewal links last a fortnight. Sign in and renew from your subscription page — nothing has been lost."}
        </p>

        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button asChild>
            <Link href="/en/signin">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/subscription">Your subscription</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
