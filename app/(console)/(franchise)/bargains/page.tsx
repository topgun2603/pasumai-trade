import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { LiveBargains } from "@/components/negotiation/live-bargains";
import { PageHeader } from "@/components/page-header";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import { readControls } from "@/lib/firebase/controls-read";
import { readNegotiations } from "@/lib/firebase/negotiations-read";
import { readRemaining } from "@/lib/firebase/remaining-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { negotiations } from "@/lib/mock/negotiations";
import { DOCUMENT_RULES, PACKS, PHRASES } from "@/lib/mock/reference";
import { isBuyingRole } from "@/lib/auth/claims";
import { verifySession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bargains · Pasumai Trade" };

export default async function BargainsPage() {
  await connection();

  // One clock, read on the server and handed down, so the countdowns render
  // identically either side of hydration.
  const now = new Date().getTime();

  // Both reads hit Firestore; neither depends on the other.
  const [{ threads, live }, { vocabulary }, controls] = await Promise.all([
    readNegotiations(negotiations(now)),
    // The same list the farmer's side gets and the same list the endpoint
    // checks against — see lib/firebase/bargain-vocabulary-read.ts.
    readBargainVocabulary(),
    readControls({
      crops: Object.values(CATALOGUE),
      geo: GEOGRAPHY,
      packs: PACKS,
      phrases: PHRASES,
      documentRules: DOCUMENT_RULES,
    }),
  ]);

  // What is unsold on each lot under negotiation, so a buyer bidding for part
  // of one cannot ask for more than is left. Read per listing, and only for the
  // listings actually being bargained over.
  const lots = Array.from(new Set(threads.map((t) => t.listingId))).filter(Boolean);
  const remaining = Object.fromEntries(
    await Promise.all(lots.map(async (id) => [id, await readRemaining(id)] as const)),
  );

  // Operations can read a bargain but never speak in one, which is the same
  // rule the endpoint enforces.
  const session = await verifySession();
  const editable =
    live && session !== null && isBuyingRole(session.claims.role);

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

      <LiveBargains
        initial={threads}
        viewer="buyer"
        now={now}
        validForMinutes={controls.policy.proposalValidityMinutes}
        vocabulary={vocabulary}
        remaining={remaining}
        editable={editable}
      />
    </div>
  );
}
