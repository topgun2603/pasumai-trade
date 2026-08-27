/**
 * Where these functions run, and why it is not simply the region we want.
 *
 * A 2nd-gen Firestore trigger is an Eventarc trigger, and Eventarc delivers a
 * Firestore event **in the database's own location**. It does not support
 * Firestore multi-regions directly: each one maps to a single region, and the
 * trigger has to be there.
 *
 *     Firestore location        Trigger region
 *     ──────────────────        ──────────────
 *     nam5   (US multi)         us-central1
 *     eur3   (EU multi)         europe-west1
 *     asia-south1 (Mumbai)      asia-south1
 *     any other single region   the same region
 *
 * **This project's database is `asia-south1`.** So the triggers below run in
 * `asia-south1` as well — which is where we wanted them: Tier 2, 2nd-gen only,
 * which is all these functions need, and next to the people using this. So
 * `REGION` and `INTENDED` agree today. They have not always, and the pair is
 * kept precisely so that the day they diverge is visible rather than silent.
 *
 * A Firestore location is fixed for the life of the database, so if the data
 * ever moves, change `REGION` to whatever the table above gives for the new
 * location and every trigger follows — they all read this one constant.
 * Putting a trigger anywhere else does not degrade; it fails.
 *
 * `npm run check:region` reads the live database location and tells you which
 * region is required, so this comment cannot quietly go stale.
 */

/** Every region a Cloud Functions v2 Firestore trigger may sit in, for us. */
export type TriggerRegion = "asia-south1" | "us-central1" | "europe-west1";

/**
 * Where we want to be: close to the farmers and the buyers using this.
 *
 * Kept as a named value rather than a comment, because it is the thing to
 * change once the database moves.
 */
export const INTENDED: TriggerRegion = "asia-south1";

/**
 * Where the database puts us today.
 *
 * Read `scripts/check-functions-region.ts` before editing this by hand: a
 * mismatch is a deploy-time error, not a runtime one, so it fails loudly — but
 * it fails after you have waited for a build.
 */
export const REGION: TriggerRegion = "asia-south1";

/**
 * Shared options for every trigger.
 *
 * `maxInstances` is a deliberate ceiling rather than a tuning knob. These
 * functions fan a single write out to a handful of notification rows; if one is
 * ever caught in a loop — a trigger whose write re-triggers itself — the cap is
 * what stops it costing money all weekend. Notifications are not latency
 * critical, so a queue behind ten instances is fine and a runaway is not.
 */
export const TRIGGER_OPTIONS = {
  region: REGION,
  maxInstances: 10,
  // A notification write is two reads and a batch. Anything approaching this
  // is stuck, and dying is better than hanging.
  timeoutSeconds: 60,
  memory: "256MiB",
} as const;
