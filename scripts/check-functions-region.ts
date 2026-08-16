/**
 * Which region the notification triggers must be deployed to.
 *
 * A 2nd-gen Firestore trigger is an Eventarc trigger, and Eventarc delivers a
 * Firestore event in the database's own location. Multi-region databases are
 * not supported directly — each maps to one region, and the trigger has to be
 * there. Deploying elsewhere does not run slowly; it fails.
 *
 * So this asks the live project where its database is and compares the answer
 * against `functions/src/region.ts`. Run it before a functions deploy, and any
 * time somebody wonders why the triggers are not in Mumbai.
 *
 *   npm run check:region
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { GoogleAuth } from "google-auth-library";

/** Minimal .env reader — a standalone script does not get Next's loader. */
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

/** Firestore location → the only region its triggers may sit in. */
const TRIGGER_REGION: Record<string, string> = {
  nam5: "us-central1",
  "nam-central1": "us-central1",
  eur3: "europe-west1",
};

function serviceAccount(): { project_id: string } & Record<string, unknown> {
  const env = { ...loadEnv(resolve(process.cwd(), ".env.local")), ...process.env };
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "";
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. This reads the live project, so it needs the service account.",
    );
  }
  return JSON.parse(
    raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
}

/** What `functions/src/region.ts` currently declares. */
function declared(): { intended: string; region: string } {
  const source = readFileSync(
    join(process.cwd(), "functions", "src", "region.ts"),
    "utf8",
  );
  const find = (name: string) =>
    source.match(new RegExp(`export const ${name}: TriggerRegion = "([^"]+)"`))?.[1] ?? "?";

  return { intended: find("INTENDED"), region: find("REGION") };
}

async function main() {
  const account = serviceAccount();

  const auth = new GoogleAuth({
    credentials: {
      client_email: account.client_email as string,
      private_key: account.private_key as string,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const response = await client.request<{
    databases?: Array<{ name: string; locationId: string; type: string }>;
  }>({
    url: `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases`,
  });

  const databases = response.data.databases ?? [];
  if (databases.length === 0) throw new Error("No Firestore database on this project.");

  console.log(`project  ${account.project_id}\n`);

  const { intended, region } = declared();
  let wrong = false;

  for (const database of databases) {
    const id = database.name.split("/").pop() ?? "(default)";
    const location = database.locationId;
    // A single-region database triggers in its own region; a multi-region maps.
    const required = TRIGGER_REGION[location] ?? location;

    console.log(`database ${id}`);
    console.log(`  location        ${location}`);
    console.log(`  triggers must be in ${required}`);

    if (id === "(default)") {
      console.log(`  region.ts says  ${region}`);
      if (required !== region) {
        wrong = true;
        console.log(
          `\n  MISMATCH. functions/src/region.ts declares ${region}, but this database` +
            `\n  requires ${required}. The deploy will fail. Change REGION to ${required}.`,
        );
      } else if (region !== intended) {
        console.log(
          `\n  Correct, but not where we want to be. INTENDED is ${intended}; the` +
            `\n  database being in ${location} is what forces ${region}. A Firestore` +
            `\n  location is fixed for the life of the database, so moving the triggers` +
            `\n  to ${intended} means creating a database there and migrating to it.`,
        );
      } else {
        console.log("\n  As intended.");
      }
    }
    console.log();
  }

  if (wrong) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
