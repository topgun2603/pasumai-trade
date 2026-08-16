/**
 * Lets browsers upload straight to the storage bucket.
 *
 *   npx tsx scripts/set-storage-cors.ts          # show what is set
 *   npx tsx scripts/set-storage-cors.ts --apply  # write it
 *
 * A Cloud Storage bucket rejects cross-origin requests from a browser unless it
 * carries a CORS policy, and a new bucket has none. Signed upload URLs work
 * perfectly from curl and fail from every browser until this is set — which is
 * exactly the trap it is easy to verify your way past, because curl does not
 * send a preflight and does not care what comes back.
 *
 * This is bucket configuration, not application code: it lives with the
 * project, survives deploys, and has to be run once per bucket.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

/**
 * Where uploads are allowed from.
 *
 * An explicit list rather than `*`. A wildcard here would let any page on the
 * internet use a leaked signed URL from the visitor's own browser, and the
 * whole point of a fifteen-minute URL scoped to one object is to keep the blast
 * radius small when one leaks.
 *
 * Preview deployments each get their own hostname and are deliberately not
 * covered; add one here while testing if you need it.
 */
const ORIGINS = ["http://localhost:3000", "https://pasumai-trade.vercel.app"];

const POLICY = [
  {
    origin: ORIGINS,
    // PUT to upload, GET and HEAD so the same bucket can serve the photos back.
    method: ["GET", "HEAD", "PUT"],
    // Content-Type has to be echoed or the signed PUT is rejected for a
    // signature mismatch; the other two let a browser read what it uploaded.
    responseHeader: ["Content-Type", "Content-Length", "ETag"],
    maxAgeSeconds: 3600,
  },
];

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function serviceAccount(env: Record<string, string | undefined>): ServiceAccount {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env: Record<string, string | undefined> = {
    ...loadEnv(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const name = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.");

  initializeApp({ credential: cert(serviceAccount(env)) });
  const bucket = getStorage().bucket(name);

  const [before] = await bucket.getMetadata();
  console.log(`bucket: ${name}`);
  console.log(`current CORS: ${JSON.stringify(before.cors ?? null)}`);

  if (!apply) {
    console.log(`\nwould set: ${JSON.stringify(POLICY, null, 2)}`);
    console.log("\nRe-run with --apply to write it.");
    return;
  }

  await bucket.setCorsConfiguration(POLICY);
  const [after] = await bucket.getMetadata();
  console.log(`\nnow: ${JSON.stringify(after.cors)}`);
  console.log("Browsers can upload from:", ORIGINS.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
