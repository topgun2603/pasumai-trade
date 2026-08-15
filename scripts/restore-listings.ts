/**
 * Rewrites the `listings` collection from the mock catalogue.
 *
 *   npx tsx scripts/restore-listings.ts
 *
 * Exists because a cleanup script deleted the whole collection when it meant
 * to delete only the documents it had just created. The seeded listings are
 * derived data — `openListings(now)` regenerates them — so this restores them
 * without running the full seed, which would also rewrite reference
 * collections that operations may have edited since.
 *
 * The shaping below is copied from `seed.ts` deliberately rather than imported:
 * if the seed's shape changes, this should keep writing what was there, and a
 * silent divergence is better caught by a diff than by a surprise.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { openListings } from "@/lib/mock/listings";

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

function serviceAccount(): ServiceAccount {
  const env = { ...loadEnv(resolve(process.cwd(), ".env.local")), ...process.env };
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
  initializeApp({ credential: cert(serviceAccount()) });
  const db = getFirestore();
  const now = new Date();

  const rows = openListings(now);
  let written = 0;

  for (const l of rows) {
    await db
      .collection("listings")
      .doc(l.id)
      .set({
        produceId: l.produce.id,
        farmerId: l.farmer.id,
        farmerName: l.farmer.name,
        village: l.farmer.village,
        district: l.farmer.district,
        quantity: l.quantity,
        unit: l.unit,
        status: l.status,
        createdAt: l.createdAt,
        photoCount: l.photoCount,
        pendingSync: l.pendingSync,
        marketRate: l.marketRate,
        offer: l.offer ?? null,
      });
    written++;
  }

  console.log(`restored ${written} listings`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
