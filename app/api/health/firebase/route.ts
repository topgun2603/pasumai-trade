import { collection, getDocsFromServer, limit, query } from "firebase/firestore";

import { firestore } from "@/lib/firebase/client";
import { hasAdminCredentials, adminDb } from "@/lib/firebase/admin";
import { firebaseConfig, missingConfigKeys } from "@/lib/firebase/config";

/**
 * Firebase connectivity check. Development only.
 *
 * Reports whether the project is reachable and whether the two SDKs are
 * configured. It never returns a config value — only which keys are present —
 * and it 404s outside development so it cannot become a reconnaissance
 * endpoint in production.
 *
 * Route handlers are uncached by default in Next 16, so this always runs live.
 */

type Probe = {
  ok: boolean;
  detail: string;
  code?: string;
};

/**
 * Reach the project with the browser SDK.
 *
 * A `permission-denied` here is a **pass**: it means the request reached
 * Firestore and Security Rules answered. That is the correct response for a
 * client read once deny-by-default rules are in place. Only a transport
 * failure means the config is wrong.
 *
 * `getDocsFromServer`, not `getDocs`. The latter can resolve from the SDK's
 * local cache and reports success against a project with no database at all —
 * which it did, giving a false pass that the Admin SDK then contradicted. A
 * health check that can succeed without touching the server is not a health
 * check.
 */
async function probeClient(): Promise<Probe> {
  try {
    await getDocsFromServer(query(collection(firestore(), "__health"), limit(1)));
    return {
      ok: true,
      detail: "Reached Firestore and rules allowed the read.",
    };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "unknown";
    if (code === "permission-denied") {
      return {
        ok: true,
        code,
        detail:
          "Reached Firestore; rules denied the read. Expected once client writes are locked down.",
      };
    }
    return {
      ok: false,
      code,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeAdmin(): Promise<Probe> {
  if (!hasAdminCredentials()) {
    return {
      ok: false,
      code: "not-configured",
      detail:
        "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Writes cannot work until it is — the Admin SDK is the only thing permitted to mutate data.",
    };
  }

  try {
    await adminDb().listCollections();
    return { ok: true, detail: "Admin SDK authenticated against the project." };
  } catch (error) {
    return {
      ok: false,
      code: (error as { code?: string })?.code ?? "unknown",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const missing = missingConfigKeys();

  if (missing.length > 0) {
    return Response.json(
      {
        projectId: firebaseConfig.projectId ?? null,
        config: { ok: false, missing },
        client: { ok: false, detail: "Skipped — config incomplete." },
        admin: { ok: false, detail: "Skipped — config incomplete." },
      },
      { status: 503 },
    );
  }

  const [client, admin] = await Promise.all([probeClient(), probeAdmin()]);

  return Response.json({
    projectId: firebaseConfig.projectId,
    analytics: firebaseConfig.measurementId ? "configured" : "disabled",
    config: { ok: true, missing: [] },
    client,
    admin,
  });
}
