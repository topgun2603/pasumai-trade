/**
 * Firebase web configuration.
 *
 * These values are public by design. A Firebase web API key is an identifier
 * for the project, not a credential — it ships in every client bundle and
 * Google documents it as safe to expose. The security boundary is Firestore
 * Security Rules plus App Check, never the key.
 *
 * They live in env vars anyway so dev, staging and production can point at
 * different projects without a code change.
 *
 * Each `process.env.NEXT_PUBLIC_*` is written out literally. Next inlines
 * these at build time by static substitution, so a computed lookup like
 * `process.env[name]` silently yields `undefined` in the browser.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/**
 * The shape the SDK needs. `databaseURL`, `storageBucket`,
 * `messagingSenderId` and `measurementId` stay optional — the app initialises
 * without them, and Analytics is skipped entirely when `measurementId` is
 * absent.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

const REQUIRED = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
] as const satisfies readonly (keyof typeof firebaseConfig)[];

/**
 * Values that are present but obviously not real.
 *
 * A production deploy once shipped with every one of these set to the literal
 * string `[SENSITIVE]` — a redacted environment dump had been pasted into the
 * host's settings, placeholders and all. Nothing complained: the values were
 * present, so the check below passed, the SDK initialised, and every call went
 * to `identitytoolkit.googleapis.com` with `key=%5BSENSITIVE%5D`. Sign-in was
 * dead for every account and the only clue was a failed request nobody could
 * read.
 *
 * A missing value and a placeholder value are the same fault with the same fix,
 * so they are reported the same way. Kept narrow on purpose — it matches
 * redaction markers and obvious fillers, never a value that merely looks odd,
 * because refusing to start on a real key would be the worse failure.
 */
const PLACEHOLDER =
  /^(?:\s*|\[[^\]]*\]|<[^>]*>|your[-_ ]?(?:api[-_ ]?key|app[-_ ]?id|project[-_ ]?id|sender[-_ ]?id|auth[-_ ]?domain|bucket|value|key|id|here)|change[-_ ]?me|x{3,}|todo|placeholder|undefined|null)$/i;

export function looksLikePlaceholder(value: string | undefined): boolean {
  return value === undefined || PLACEHOLDER.test(value.trim());
}

export function missingConfigKeys(): string[] {
  return REQUIRED.filter((key) => looksLikePlaceholder(firebaseConfig[key]));
}

/**
 * Returns the config, or throws naming exactly which variables are missing.
 *
 * A returned value rather than an assertion signature: `asserts x is T` is
 * only valid for a parameter, not for a module-level binding.
 */
export function requireFirebaseConfig(): FirebaseWebConfig {
  const missing = missingConfigKeys();
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured. Missing or placeholder: ${missing
        .map((k) => `NEXT_PUBLIC_FIREBASE_${camelToScreaming(k)}`)
        .join(", ")}. These are inlined at build time, so setting them on the ` +
        `host is not enough — the deployment has to be rebuilt.`,
    );
  }
  return firebaseConfig as FirebaseWebConfig;
}

function camelToScreaming(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}
