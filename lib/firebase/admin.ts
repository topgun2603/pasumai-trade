import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type Credential,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { IdentityPoolClient } from "google-auth-library";

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
 * Credentials arrive by one of three routes, tried in this order:
 *
 *   1. `FIREBASE_SERVICE_ACCOUNT_KEY` — the service account JSON, base64 on one
 *      line. Explicit, and so it wins where it is set.
 *   2. Workload Identity Federation — a Vercel OIDC token exchanged for a
 *      short-lived Google token. No key exists to be leaked, which is what the
 *      `iam.disableServiceAccountKeyCreation` org policy is there to ensure.
 *   3. Application Default Credentials — the metadata server on Google
 *      infrastructure, or `gcloud auth application-default login` locally.
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

/**
 * Scopes the federated token is minted with.
 *
 * `cloud-platform` covers Firestore and Storage. Auth is a separate product
 * with a separate scope, and leaving `identitytoolkit` out yields a client that
 * reads documents perfectly well and fails only when somebody signs in.
 */
const FEDERATED_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
  "https://www.googleapis.com/auth/identitytoolkit",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** Where `gcloud auth application-default login` leaves its credentials. */
function wellKnownAdcPath(): string {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? "")
      : join(process.env.HOME ?? "", ".config");
  return join(base, "gcloud", "application_default_credentials.json");
}

let adcAvailable: boolean | undefined;

/**
 * Whether the SDK will find Application Default Credentials by itself.
 *
 * Deliberately more than a `GOOGLE_APPLICATION_CREDENTIALS` check. That
 * variable is only one of the ways ADC resolves: on Google infrastructure the
 * metadata server answers, and after `gcloud auth application-default login`
 * the credentials sit in a well-known file with nothing pointing at them.
 * Testing the variable alone reported "not configured" on a machine that could
 * authenticate perfectly well.
 *
 * Cached because it touches the filesystem and is asked on every read.
 */
function applicationDefaultCredentials(): boolean {
  if (adcAvailable !== undefined) return adcAvailable;
  adcAvailable =
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    // Cloud Run, Cloud Functions and App Engine each set one of these, and all
    // three have a metadata server to ask.
    Boolean(
      process.env.K_SERVICE ?? process.env.FUNCTION_TARGET ?? process.env.GAE_ENV,
    ) ||
    existsSync(wellKnownAdcPath());
  return adcAvailable;
}

/** Whether federation is configured *and* has a token to exchange. */
function federationConfigured(): boolean {
  return Boolean(
    process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE &&
      process.env.GCP_SERVICE_ACCOUNT_EMAIL &&
      process.env.VERCEL_OIDC_TOKEN,
  );
}

/**
 * Workload Identity Federation — Admin credentials with no key to leak.
 *
 * Vercel issues every deployment a short-lived OIDC token saying which project
 * and environment it is. Google exchanges that for an access token
 * impersonating a service account, so the thing granting total access to
 * Firestore expires within the hour and never exists as a file anyone can
 * copy. Under `iam.disableServiceAccountKeyCreation` there is no downloadable
 * key to configure even if we wanted one.
 *
 * Returns null when unconfigured, leaving the key and ADC paths untouched.
 */
function federatedCredential(): Credential | null {
  const audience = process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE;
  const serviceAccount = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  if (!audience || !serviceAccount) return null;

  const client = new IdentityPoolClient({
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    service_account_impersonation_url:
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
      `${serviceAccount}:generateAccessToken`,
    scopes: FEDERATED_SCOPES,
    subject_token_supplier: {
      // Read on every exchange rather than captured once: Vercel mints a fresh
      // token per invocation, and a captured one is expired by its second use.
      getSubjectToken: () => {
        const token = process.env.VERCEL_OIDC_TOKEN;
        if (!token) {
          throw new Error(
            "VERCEL_OIDC_TOKEN is not set, so there is no identity to exchange " +
              "for Google credentials. Vercel injects it at runtime; locally, " +
              "run `vercel env pull`.",
          );
        }
        return Promise.resolve(token);
      },
    },
  });

  return {
    async getAccessToken() {
      const { token } = await client.getAccessToken();
      if (!token) {
        throw new Error(
          "Workload Identity Federation returned no access token. Check that " +
            "GCP_WORKLOAD_IDENTITY_AUDIENCE names this project's pool provider, " +
            "and that the service account grants it roles/iam.workloadIdentityUser.",
        );
      }
      const expiry = client.credentials.expiry_date;
      return {
        access_token: token,
        // The SDK re-asks once this lapses, so underestimating is safe and
        // overestimating is not. Default low rather than assume the usual hour.
        expires_in: expiry
          ? Math.max(0, Math.round((expiry - Date.now()) / 1000))
          : 300,
      };
    },
  };
}

export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      federationConfigured() ||
      applicationDefaultCredentials(),
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
  // An explicit key wins where one is set, so setting it is never a no-op.
  const federated = serviceAccount ? null : federatedCredential();

  if (!serviceAccount && !federated && !applicationDefaultCredentials()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY " +
        "(base64-encoded service account JSON), or GCP_WORKLOAD_IDENTITY_AUDIENCE " +
        "and GCP_SERVICE_ACCOUNT_EMAIL to federate a Vercel OIDC token, or run " +
        "`gcloud auth application-default login`, or deploy to Google " +
        "infrastructure where the metadata server answers.",
    );
  }

  const credential = serviceAccount ? cert(serviceAccount) : federated;

  cached = initializeApp(
    {
      ...(credential ? { credential } : {}),
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

/**
 * The storage bucket, for signing upload URLs.
 *
 * The bucket name comes from the same public config the browser uses, because
 * it is the same bucket — there is nothing secret about which one it is. What
 * is secret is the key that signs URLs for it, which is why signing happens
 * here and never in the browser.
 */
export function adminStorage() {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set, so uploads cannot be signed.",
    );
  }
  return getStorage(adminApp()).bucket(bucket);
}

/** Present so `getApp` stays referenced for the named-app lookup path. */
export { getApp };
