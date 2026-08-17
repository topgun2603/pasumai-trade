/**
 * Why `firebase deploy --only functions` is failing.
 *
 *   npm run check:deploy
 *
 * The CLI reports almost every setup problem as the same sentence:
 *
 *   We failed to modify the IAM policy for the project. The functions
 *   deployment requires specific roles to be granted to service agents,
 *   otherwise the deployment will fail.
 *
 * That sentence sends you to the IAM page, which is usually the wrong place.
 * The binding it could not write is nearly always rejected because the
 * *principal does not exist* — service agents are provisioned lazily, and a
 * project that has never run Eventarc or Pub/Sub has no such account to grant
 * a role to. Underneath that, the usual reason nothing has been provisioned is
 * that the project is still on the Spark plan: 2nd-gen functions require Blaze.
 *
 * So this checks the chain in the order it actually breaks — plan, APIs,
 * service agents, then bindings — and prints the commands to fix whatever is
 * missing. Read-only: it changes nothing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

/** APIs a 2nd-gen deploy with a Firestore trigger needs switched on. */
const APIS = [
  "cloudfunctions.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "run.googleapis.com",
  "eventarc.googleapis.com",
  "pubsub.googleapis.com",
  "compute.googleapis.com",
  "firestore.googleapis.com",
];

async function main() {
  const env = { ...loadEnv(resolve(process.cwd(), ".env.local")), ...process.env };
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set.");

  const account = JSON.parse(
    raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
  const projectId = account.project_id as string;

  const auth = new GoogleAuth({
    credentials: { client_email: account.client_email, private_key: account.private_key },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const project = await client.request<{ projectNumber?: string }>({
    url: `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
  });
  const number = project.data.projectNumber ?? "";

  console.log(`project ${projectId} (${number})\n`);

  const fixes: string[] = [];

  /* Billing ---------------------------------------------------------------- */

  console.log("plan:");
  try {
    const res = await client.request<{ billingEnabled?: boolean }>({
      url: `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
    });
    const paid = res.data.billingEnabled === true;
    console.log(`  ${paid ? "Blaze" : "SPARK — 2nd-gen functions cannot deploy"}`);
    if (!paid) {
      fixes.push(
        `Upgrade to Blaze:\n` +
          `  https://console.firebase.google.com/project/${projectId}/usage/details`,
      );
    }
  } catch {
    // The Billing API itself is off, which is common on a Spark project and
    // tells us nothing on its own. Say so rather than guessing either way.
    console.log("  unknown — the Cloud Billing API is not enabled on this project");
    console.log(
      `  check by eye: https://console.firebase.google.com/project/${projectId}/usage/details`,
    );
  }

  /* APIs -------------------------------------------------------------------- */

  console.log("\nAPIs:");
  const off: string[] = [];
  for (const api of APIS) {
    try {
      const res = await client.request<{ state?: string }>({
        url: `https://serviceusage.googleapis.com/v1/projects/${number}/services/${api}`,
      });
      const on = res.data.state === "ENABLED";
      if (!on) off.push(api);
      console.log(`  ${on ? "on " : "OFF"}  ${api}`);
    } catch {
      off.push(api);
      console.log(`  ?    ${api}`);
    }
  }
  if (off.length > 0) {
    fixes.push(`Enable the APIs:\n  gcloud services enable ${off.join(" ")} --project=${projectId}`);
  }

  /* Service agents ---------------------------------------------------------- */

  const AGENTS: Array<{ email: string; api: string; role?: string }> = [
    {
      email: `${number}-compute@developer.gserviceaccount.com`,
      api: "compute.googleapis.com",
      role: "roles/eventarc.eventReceiver",
    },
    {
      email: `service-${number}@gcp-sa-pubsub.iam.gserviceaccount.com`,
      api: "pubsub.googleapis.com",
      role: "roles/iam.serviceAccountTokenCreator",
    },
    {
      email: `service-${number}@gcp-sa-eventarc.iam.gserviceaccount.com`,
      api: "eventarc.googleapis.com",
    },
  ];

  console.log("\nservice agents (a role cannot be granted to an account that does not exist):");
  const absent: typeof AGENTS = [];
  for (const agent of AGENTS) {
    try {
      await client.request({
        url:
          `https://iam.googleapis.com/v1/projects/${projectId}` +
          `/serviceAccounts/${encodeURIComponent(agent.email)}`,
      });
      console.log(`  exists   ${agent.email}`);
    } catch {
      absent.push(agent);
      console.log(`  MISSING  ${agent.email}`);
    }
  }
  if (absent.length > 0) {
    fixes.push(
      "Provision the missing service agents — they are created lazily, and\n" +
        "propagation takes a few minutes:\n" +
        absent
          .map((a) => `  gcloud beta services identity create --service=${a.api} --project=${projectId}`)
          .join("\n"),
    );
  }

  /* Bindings ---------------------------------------------------------------- */

  const policy = await client.request<{
    bindings?: Array<{ role: string; members?: string[] }>;
  }>({
    url: `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
    method: "POST",
    data: { options: { requestedPolicyVersion: 3 } },
  });
  const bindings = policy.data.bindings ?? [];

  console.log("\nrole bindings the first deploy writes:");
  const ungranted: Array<{ member: string; role: string }> = [];
  for (const agent of AGENTS) {
    if (!agent.role) continue;
    const member = `serviceAccount:${agent.email}`;
    const held = bindings.some(
      (b) => b.role === agent.role && (b.members ?? []).includes(member),
    );
    if (!held) ungranted.push({ member, role: agent.role });
    console.log(`  ${held ? "granted" : "missing"}  ${agent.role}`);
    console.log(`           ${agent.email}`);
  }
  if (ungranted.length > 0) {
    fixes.push(
      "Grant the bindings (the CLI does this itself once the agents exist and\n" +
        "you deploy as an Owner):\n" +
        ungranted
          .map(
            (b) =>
              `  gcloud projects add-iam-policy-binding ${projectId} \\\n` +
              `    --member="${b.member}" --role="${b.role}"`,
          )
          .join("\n"),
    );
  }

  /* ------------------------------------------------------------------------- */

  if (fixes.length === 0) {
    console.log("\nNothing missing. If the deploy still fails, run it with --debug.");
    return;
  }

  console.log(`\n${"-".repeat(70)}\nIn order:\n`);
  fixes.forEach((fix, i) => console.log(`${i + 1}. ${fix}\n`));
  console.log(
    "Deploy as an Owner of the project, not with the Admin SDK service account —\n" +
      "writing these bindings needs resourcemanager.projects.setIamPolicy, which\n" +
      "that account has not got and should not be given.",
  );
  process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
