/**
 * Reports whether SMS sign-in can actually work on this project.
 *
 *   npx tsx scripts/check-auth-config.ts
 *
 * Exists because phone auth fails as a bare `400` from
 * `identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode`, with the
 * reason only in a response body nobody sees unless they open the Network tab
 * and expand it. Three separate pieces of project configuration can cause it,
 * none of them visible from the code, and all three are checked here.
 *
 * The one that bit this project: `smsRegionConfig` defaults to allowlist-only
 * with an *empty* allowlist on newer Firebase projects — a sensible default
 * against SMS pumping, and a total block on every country including India until
 * somebody adds one.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GoogleAuth } from "google-auth-library";

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

interface Config {
  signIn?: { phoneNumber?: { enabled?: boolean; testPhoneNumbers?: Record<string, string> } };
  smsRegionConfig?: {
    allowlistOnly?: { allowedRegions?: string[] };
    allowByDefault?: { disallowedRegions?: string[] };
  };
  authorizedDomains?: string[];
}

async function main() {
  const env = { ...loadEnv(resolve(process.cwd(), ".env.local")), ...process.env };
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set.");
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const account = JSON.parse(json);

  const auth = new GoogleAuth({
    credentials: { client_email: account.client_email, private_key: account.private_key },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${account.project_id}/config`;
  const config = (await client.request<Config>({ url })).data;

  const problems: string[] = [];

  /* Provider ------------------------------------------------------------- */

  const phone = config.signIn?.phoneNumber;
  if (phone?.enabled) {
    console.log("✓ Phone sign-in provider is enabled");
  } else {
    console.log("✗ Phone sign-in provider is DISABLED");
    problems.push("Enable Phone in Firebase Console → Authentication → Sign-in method.");
  }

  const testNumbers = Object.entries(phone?.testPhoneNumbers ?? {});
  if (testNumbers.length > 0) {
    console.log(`  test numbers: ${testNumbers.map(([n, c]) => `${n} → ${c}`).join(", ")}`);
  }

  /* SMS regions ---------------------------------------------------------- */

  const region = config.smsRegionConfig;
  const allowed = region?.allowlistOnly?.allowedRegions;

  if (region?.allowlistOnly && (!allowed || allowed.length === 0)) {
    // The failure mode this script was written for.
    console.log("✗ SMS region policy is allowlist-only with an EMPTY list");
    console.log("  Every destination is blocked. sendVerificationCode returns 400.");
    problems.push('Add "IN" to the SMS region allowlist.');
  } else if (allowed) {
    const hasIndia = allowed.includes("IN");
    console.log(`${hasIndia ? "✓" : "✗"} SMS allowed for: ${allowed.join(", ")}`);
    if (!hasIndia) problems.push('India ("IN") is not in the SMS region allowlist.');
  } else if (region?.allowByDefault) {
    const denied = region.allowByDefault.disallowedRegions ?? [];
    const indiaBlocked = denied.includes("IN");
    console.log(
      `${indiaBlocked ? "✗" : "⚠"} SMS allowed everywhere except: ${denied.join(", ") || "nowhere"}`,
    );
    if (indiaBlocked) problems.push('India ("IN") is on the SMS deny list.');
    else
      console.log(
        "  Open to every country — cheap to leave, expensive if abused. Consider allowlisting IN.",
      );
  } else {
    console.log("⚠ No SMS region policy set");
  }

  /* Authorised domains --------------------------------------------------- */

  const domains = config.authorizedDomains ?? [];
  console.log(`  authorised domains: ${domains.join(", ")}`);
  // reCAPTCHA refuses to run on a host that is not listed, and the SDK reports
  // that as a captcha failure rather than as the configuration problem it is.
  for (const needed of ["localhost", "pasumai-trade.vercel.app"]) {
    if (!domains.includes(needed)) {
      console.log(`✗ ${needed} is not authorised — reCAPTCHA will refuse to run there`);
      problems.push(`Add ${needed} to Authentication → Settings → Authorized domains.`);
    }
  }
  if (domains.some((d) => d.endsWith(".vercel.app") && d.includes("-"))) {
    console.log("  note: preview deployments each get their own host and are not covered");
  }

  /* ---------------------------------------------------------------------- */

  if (problems.length === 0) {
    console.log("\nSMS sign-in looks correctly configured.");
    return;
  }

  console.log(`\n${problems.length} problem(s) to fix:`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
