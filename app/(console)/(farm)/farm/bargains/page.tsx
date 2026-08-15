import { HandshakeIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { BargainConsole } from "@/components/negotiation/bargain-console";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireFarmer } from "@/lib/auth/farm";
import { isSubscribed } from "@/lib/domain/subscription";
import { readControls } from "@/lib/firebase/controls-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { negotiations } from "@/lib/mock/negotiations";
import { DOCUMENT_RULES, PACKS, PHRASES } from "@/lib/mock/reference";

export const metadata: Metadata = { title: "Bargains · Farmer" };

/**
 * The farmer's side of the bargain.
 *
 * The same console the buyer uses, with `viewer="farmer"` — one implementation
 * of the rules, seen from the other end. A second component would be a second
 * place for the accept guard to drift.
 */
export default async function FarmBargainsPage() {
  await connection();

  const { farmer, subscription } = await requireFarmer();
  const now = new Date();
  const clock = now.getTime();

  const [{ threads }, controls] = await Promise.all([
    readNegotiations(negotiations(clock)),
    readControls({
      crops: Object.values(CATALOGUE),
      geo: GEOGRAPHY,
      packs: PACKS,
      phrases: PHRASES,
      documentRules: DOCUMENT_RULES,
    }),
  ]);

  // Scoped by the session's farmer id. There is no path that takes one from
  // the URL.
  const mine = threads.filter((t) => t.farmerId === farmer.id);
  const subscribed = isSubscribed(subscription, now);

  return (
    <>
      <PageHeader
        title="Bargains"
        description="Buyers offer, you counter. Nothing is binding until one of you accepts."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        {!subscribed ? (
          <div className="border-warning/30 bg-warning-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <LockIcon className="size-4 shrink-0" />
              You can read every bargain. Replying and accepting need a plan.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/farm/subscription">See plans</Link>
            </Button>
          </div>
        ) : null}

        {mine.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
            <HandshakeIcon className="size-7" />
            <p className="max-w-sm text-sm">
              No bargains yet. Once a buyer offers on your produce, the conversation appears here.
            </p>
          </div>
        ) : (
          <BargainConsole
            threads={mine}
            viewer="farmer"
            now={clock}
            quickReplies={controls.phrases}
            validForMinutes={controls.policy.proposalValidityMinutes}
            // Reading stays open; writing is gated. The server checks again and
            // answers 402 — this only decides whether the composer is live.
            editable={subscribed}
          />
        )}
      </div>
    </>
  );
}
