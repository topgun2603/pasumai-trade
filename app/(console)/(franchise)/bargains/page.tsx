import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { BargainConsole } from "@/components/negotiation/bargain-console";
import { PageHeader } from "@/components/page-header";
import { readControls } from "@/lib/firebase/controls-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { negotiations } from "@/lib/mock/negotiations";
import { DOCUMENT_RULES, PACKS, PHRASES } from "@/lib/mock/reference";
import { verifySession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bargains · Pasumai Trade" };

export default async function BargainsPage() {
  await connection();

  // One clock, read on the server and handed down, so the countdowns render
  // identically either side of hydration.
  const now = new Date().getTime();

  // Both reads hit Firestore; neither depends on the other.
  const [{ threads, live }, controls] = await Promise.all([
    readNegotiations(negotiations(now)),
    readControls({
      crops: Object.values(CATALOGUE),
      geo: GEOGRAPHY,
      packs: PACKS,
      phrases: PHRASES,
      documentRules: DOCUMENT_RULES,
    }),
  ]);

  // Quick replies and the hold time come from Controls, so operations can add
  // a phrase or shorten a quote's life without a deploy.
  const quickReplies = controls.phrases
    .filter((p) => p.kind === "quickReply" && p.active)
    .map((p) => ({ id: p.id, text: p.text }));

  // Operations can read a bargain but never speak in one, which is the same
  // rule the endpoint enforces.
  const session = await verifySession();
  const editable = live && session?.claims.role === "buyer";

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="Bargains"
        description="Settle a price with the farmer before the vehicle is committed. Bid on one grade or several — grading happens at the farm gate, and a grade priced now is a grade nobody reopens there."
      />

      {editable ? null : (
        <div className="border-warning/40 bg-warning-soft text-warning m-6 flex items-start gap-3 rounded-lg border p-4">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Read only</span>
            <span className="text-foreground/80">
              {live
                ? "Sending is disabled in production until the console is behind authentication. The endpoint takes the sender from the request, so without a session anyone could accept a price on the farmer's behalf."
                : "Showing sample threads: no Admin credentials, or nothing seeded yet. Run npm run seed to bargain against real data."}
            </span>
          </div>
        </div>
      )}

      <BargainConsole
        threads={threads}
        viewer="buyer"
        now={now}
        quickReplies={quickReplies}
        validForMinutes={controls.policy.proposalValidityMinutes}
        editable={editable}
      />
    </div>
  );
}
