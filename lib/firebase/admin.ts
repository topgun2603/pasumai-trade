import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * The Admin SDK — the only thing in this codebase permitted to write.
 *
 * It bypasses Security Rules entirely, which is exactly why it is confined to
 * the server. The `server-only` import makes a client component that reaches
 * for this a build error rather than a leaked service account.
 *
 * Every mutation goes through here, behind `verifySession()`, inside a route
 * handler that enforces the order state machine. See the architecture doc,
 * "Trust boundary".
 *
 * Credentials come from `FIREBASE_SERVICE_ACCOUNT_KEY` — the service account
 * JSON, base64-encoded so it survives being a single-line env var. On Google
 * infrastructure, drop the variable and Application Default Credentials are
 * used instead.
 */

const ADMIN_APP_NAME = "pasumai-admin";

let cached: App | undefined;

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  let json: string;
  try {
    // Accept raw JSON too, so a local .env.local can hold either form.
    json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is set but is neither JSON nor valid base64.",
    );
  }

  try {
    const parsed = JSON.parse(json);
    return {
      projectId: parsed.project_id ?? parsed.projectId,
      clientEmail: parsed.client_email ?? parsed.clientEmail,
      privateKey: parsed.private_key ?? parsed.privateKey,
    };
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY did not parse as service account JSON.",
    );
  }
}

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

export function adminApp(): App {
  if (cached) return cached;

  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existing) {
    cached = existing;
    return cached;
  }

  const serviceAccount = readServiceAccount();

  if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY " +
        "(base64-encoded service account JSON) in .env.local, or run on " +
        "Google infrastructure with Application Default Credentials.",
    );
  }

  cached = initializeApp(
    {
      ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
      projectId:
        serviceAccount?.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    },
    ADMIN_APP_NAME,
  );

  return cached;
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** Present so `getApp` stays referenced for the named-app lookup path. */
export { getApp };
