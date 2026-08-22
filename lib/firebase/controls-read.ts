import "server-only";

import { cache } from "react";

import type { Geography } from "@/lib/domain/location";
import type { Produce } from "@/lib/domain/models";
import {
  readPolicy,
  POLICY_DOC_ID,
  type PlatformPolicy,
} from "@/lib/domain/policy";
import type { DocumentRule, Pack, Phrase } from "@/lib/mock/reference";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Reads reference data for the Controls page.
 *
 * Straight from Firestore via the Admin SDK, so what the page shows is what
 * the database holds — which is the only way an edit made on that page can be
 * trusted to have taken. Client mutations call the controls API and then
 * `router.refresh()`, which re-runs these reads.
 *
 * Falls back to the seeded mocks when Admin credentials are absent, so the
 * page still renders on a machine without the service account rather than
 * erroring. The caller is told which it got, and says so on screen — a page
 * that silently shows mock data while offering Save buttons is worse than one
 * that refuses.
 */
export interface ControlsData {
  readonly crops: Produce[];
  readonly geo: Geography;
  readonly packs: Pack[];
  readonly phrases: Phrase[];
  readonly documentRules: DocumentRule[];
  readonly policy: PlatformPolicy;
  readonly live: boolean;
}

export interface ControlsFallback {
  crops: Produce[];
  geo: Geography;
  packs: Pack[];
  phrases: Phrase[];
  documentRules: DocumentRule[];
}

export async function readControls(
  fallback: ControlsFallback,
): Promise<ControlsData> {
  const offline: ControlsData = {
    ...fallback,
    // The policy defaults *are* the values the code used before Controls
    // existed, so an unconnected page shows exactly what the platform does.
    policy: readPolicy(undefined),
    live: false,
  };

  if (!hasAdminCredentials()) return offline;

  try {
    const db = adminDb();
    const [
      produce,
      states,
      districts,
      places,
      packs,
      phrases,
      rules,
      settings,
    ] = await Promise.all([
      db.collection("produce").get(),
      db.collection("states").get(),
      db.collection("districts").get(),
      db.collection("places").get(),
      db.collection("packs").get(),
      db.collection("phrases").get(),
      db.collection("documentRules").get(),
      db.collection("settings").doc(POLICY_DOC_ID).get(),
    ]);

    // An empty project is not a live read — it would show an empty catalogue
    // and invite someone to "fix" it by re-adding everything by hand.
    if (produce.empty && states.empty) return offline;

    const crops: Produce[] = produce.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          names: (data.names ?? { en: doc.id }) as Produce["names"],
          regional: data.regional ?? undefined,
          grading: data.grading ?? undefined,
          emoji: data.emoji ?? "",
          iconUrl: data.iconUrl ?? null,
          defaultUnit: data.defaultUnit ?? "kg",
          shelfLifeHours: data.shelfLifeHours ?? null,
          active: data.active ?? true,
        };
      })
      .sort((a, b) => a.names.en.localeCompare(b.names.en, "en-IN"));

    const geo: Geography = {
      states: states.docs
        .map((doc) => ({
          id: doc.id,
          name: doc.data().name ?? doc.id,
          nativeName: doc.data().nativeName ?? doc.data().name ?? doc.id,
          locale: doc.data().locale ?? "en",
          vehiclePrefix: doc.data().vehiclePrefix ?? "",
          active: doc.data().active ?? false,
        }))
        // Live states first, then alphabetical — the ones being operated are
        // the ones being edited.
        .sort(
          (a, b) =>
            Number(b.active) - Number(a.active) ||
            a.name.localeCompare(b.name, "en-IN"),
        ),
      districts: districts.docs.map((doc) => ({
        id: doc.id,
        stateId: doc.data().stateId ?? "",
        name: doc.data().name ?? doc.id,
        nativeName: doc.data().nativeName ?? undefined,
        minOrderValue: doc.data().minOrderValue ?? null,
        active: doc.data().active ?? false,
      })),
      places: places.docs.map((doc) => ({
        id: doc.id,
        districtId: doc.data().districtId ?? "",
        name: doc.data().name ?? doc.id,
        nativeName: doc.data().nativeName ?? undefined,
        pincode: doc.data().pincode ?? "",
        // Null, never zero. `0, 0` is a real point in the Atlantic and would
        // be treated as a pinned village.
        lat: doc.data().lat ?? null,
        lng: doc.data().lng ?? null,
        farmerCount: doc.data().farmerCount ?? 0,
        active: doc.data().active ?? false,
      })),
    };

    return {
      crops,
      geo,
      packs: packs.empty
        ? fallback.packs
        : packs.docs
            .map((doc) => ({
              id: doc.id,
              unit: doc.data().unit ?? "kg",
              container: doc.data().container ?? "",
              packSize: doc.data().packSize ?? 0,
              label: doc.data().label ?? doc.id,
              active: doc.data().active ?? true,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, "en-IN")),
      phrases: phrases.empty
        ? fallback.phrases
        : phrases.docs.map((doc) => ({
            id: doc.id,
            kind: doc.data().kind ?? "notification",
            event: doc.data().event ?? null,
            channel: doc.data().channel ?? null,
            audience: doc.data().audience ?? "farmer",
            text: doc.data().text ?? { en: doc.id },
            active: doc.data().active ?? true,
          })),
      documentRules: rules.empty
        ? fallback.documentRules
        : rules.docs.map((doc) => ({
            id: doc.id,
            stateId: doc.data().stateId ?? "",
            subject: doc.data().subject ?? "farmer",
            required: doc.data().required ?? [],
            active: doc.data().active ?? true,
          })),
      policy: readPolicy(settings.exists ? settings.data() : undefined),
      live: true,
    };
  } catch {
    // A Firestore outage should degrade the page, not break it.
    return offline;
  }
}

/**
 * Just the policy numbers, for callers that need one threshold rather than the
 * whole reference set.
 *
 * `readControls` reads eight collections; the chat endpoint wants two hours out
 * of one document, and pulling every crop name to find them would be silly.
 * Cached per request like the rest, so a page reading both pays for one.
 *
 * Falls back to the defaults rather than throwing: a chat that cannot reach
 * Firestore should still answer with the published hours it was shipped with.
 */
export const readPlatformPolicy = cache(
  async function readPlatformPolicy(): Promise<PlatformPolicy> {
    if (!hasAdminCredentials()) return readPolicy(undefined);

    try {
      const snapshot = await adminDb()
        .collection("settings")
        .doc(POLICY_DOC_ID)
        .get();
      return readPolicy(snapshot.exists ? snapshot.data() : undefined);
    } catch {
      return readPolicy(undefined);
    }
  },
);
