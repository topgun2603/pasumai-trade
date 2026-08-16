import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";

import {
  CropCatalogue,
  FixedVocabulary,
  LocationsPanel,
} from "@/components/admin/controls-panels";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  BargainVocabularyPanel,
  DocumentRulesPanel,
  PacksPanel,
  PhrasesPanel,
  PolicyPanel,
} from "@/components/admin/reference-panels";
import { Separator } from "@/components/ui/separator";
import { readBargainVocabulary } from "@/lib/firebase/bargain-vocabulary-read";
import { readControls } from "@/lib/firebase/controls-read";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { DOCUMENT_RULES, PACKS, PHRASES } from "@/lib/mock/reference";
import { verifySession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Controls · Admin" };

export default async function ControlsPage() {
  await connection();

  const [
    { crops, geo, packs, phrases, documentRules, policy, live },
    { vocabulary, live: vocabularyLive },
  ] = await Promise.all([
    readControls({
      crops: Object.values(CATALOGUE),
      geo: GEOGRAPHY,
      packs: PACKS,
      phrases: PHRASES,
      documentRules: DOCUMENT_RULES,
    }),
    // Its own read rather than part of Controls: the bargaining screens need
    // this list without pulling the whole crop catalogue and geography with it,
    // so it lives in a reader they can call on their own.
    readBargainVocabulary(),
  ]);

  // Editing is offered only when a save would actually take: the record has to
  // have come from Firestore, and the write endpoints refuse in production
  // because they are not behind auth yet. Disabled buttons with an explanation
  // beat buttons that fail after the fact.
  // Same rule the endpoint enforces, so a button cannot offer what a save
  // would refuse. Operations only.
  const session = await verifySession();
  const editable = live && session?.claims.role === "admin";

  return (
    <>
      <AdminPageHeader
        title="Controls"
        description="The reference data behind every dropdown, filter, message and rule threshold on the platform. Editing a crop name or a village here changes what a farmer sees in their picker — no deploy, no developer."
      />

      <div className="flex flex-col gap-8 p-6">
        {editable ? null : (
          <div className="border-warning/40 bg-warning-soft text-warning flex items-start gap-3 rounded-lg border p-4">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Read only</span>
              <span className="text-foreground/80">
                {live
                  ? "Editing is disabled in production until the console is behind authentication — the write endpoints return 404 there, because they hold Admin credentials and cannot yet tell who is calling."
                  : "Showing the built-in sample data: no Admin credentials, or the database is empty. Run npm run seed and set the service account to edit the real catalogue."}
              </span>
            </div>
          </div>
        )}

        <PolicyPanel policy={policy} editable={editable} />
        <Separator />
        <LocationsPanel geo={geo} policy={policy} editable={editable} />
        <Separator />
        <CropCatalogue crops={crops} districts={geo.districts} editable={editable} />
        <Separator />
        <PacksPanel packs={packs} editable={editable} />
        <Separator />
        <PhrasesPanel phrases={phrases} editable={editable} />
        <Separator />
        <BargainVocabularyPanel
          vocabulary={vocabulary}
          live={vocabularyLive}
          editable={editable}
        />
        <Separator />
        <DocumentRulesPanel
          rules={documentRules}
          states={geo.states}
          editable={editable}
        />
        <Separator />
        <FixedVocabulary />
      </div>
    </>
  );
}
