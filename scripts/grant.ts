/**
 * Creates a sign-in and gives it a role.
 *
 *   npm run grant -- admin ops@srirealtime.com
 *   npm run grant -- buyer  purchasing@kongu.in  B-1001
 *   npm run grant -- agency ops@kaverilabour.in  AG-101
 *   npm run grant -- farmer murugan@example.in   F-201
 *
 * This exists because of a chicken and egg: the console is closed to anyone
 * without an admin role, and roles are granted from the console. Something
 * outside the application has to mint the first one, and it needs Admin
 * credentials — which is exactly why it is a script run by whoever holds the
 * service account, and not a page anybody can reach.
 *
 * Accounts are created here rather than by self-signup on purpose. A buyer is
 * verified against a GST number before they may order and a farmer is onboarded
 * by a franchise, so "anyone can register" is the wrong shape for this platform.
 *
 * Idempotent: run it again to change a role, reset a password, or re-point an
 * account id. It never deletes a user.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { ROLES, type Role } from "@/lib/auth/claims";

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
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Granting a role needs Admin credentials.",
    );
  }
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

/**
 * Long, random, and printed once.
 *
 * Nothing here invents a memorable password. A generated one that has to be
 * changed is safer than a convention somebody reuses across accounts.
 */
function generatePassword(): string {
  return randomBytes(15).toString("base64url");
}

function usage(message: string): never {
  console.error(`\n${message}\n`);
  console.error("  npm run grant -- <role> <email> [accountId]\n");
  console.error(`  role       one of: ${ROLES.join(", ")}`);
  console.error("  email      the sign-in address");
  console.error(
    "  accountId  the buyer or farmer document id — required for those roles,",
  );
  console.error("             because every rule scoped to 'your own records'");
  console.error("             compares against it. Omit for admin.\n");
  process.exit(1);
}

async function main() {
  const [role, email, accountId] = process.argv.slice(2);

  if (!role || !email) usage("Missing arguments.");
  if (!(ROLES as readonly string[]).includes(role)) {
    usage(`Unknown role "${role}".`);
  }
  if ((role === "buyer" || role === "farmer" || role === "agency") && !accountId) {
    usage(`A ${role} needs an account id — their record on the platform.`);
  }

  const account = serviceAccount();
  const app = initializeApp({ credential: cert(account), projectId: account.projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Refuse an account id that matches no record. A claim pointing at nothing
  // produces a console where every scoped query returns empty and nothing
  // explains why.
  if (accountId) {
    const collection =
      role === "buyer" ? "buyers" : role === "agency" ? "agencies" : "farmers";
    const doc = await db.collection(collection).doc(accountId).get();
    if (!doc.exists) {
      console.error(
        `\nNo ${collection} document "${accountId}". Seed or create the account first.\n`,
      );
      process.exit(1);
    }
    console.log(`Linking to ${collection}/${accountId} — ${doc.data()?.name ?? "unnamed"}`);
  }

  let uid: string;
  let password: string | null = null;

  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`Found existing user ${email}`);
  } catch {
    password = generatePassword();
    const created = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });
    uid = created.uid;
    console.log(`Created ${email}`);
  }

  // Districts come off the account record so a claim can never disagree with
  // it. A buyer sources from these; an agency sends crew and vehicles to them.
  const districts =
    role === "buyer" || role === "agency"
      ? ((
          await db
            .collection(role === "buyer" ? "buyers" : "agencies")
            .doc(accountId!)
            .get()
        ).data()?.districts ?? [])
      : undefined;

  // Replaces the whole claim set rather than merging: a user demoted from admin
  // to buyer must not keep an admin claim nobody remembered to remove.
  await auth.setCustomUserClaims(uid, {
    role: role as Role,
    ...(accountId ? { accountId } : {}),
    ...(districts ? { districts } : {}),
  });

  // Existing sessions carry the old claims until their token refreshes, so a
  // change of role has to end them.
  await auth.revokeRefreshTokens(uid);

  console.log(`\n  role       ${role}`);
  if (accountId) console.log(`  accountId  ${accountId}`);
  if (districts?.length) console.log(`  districts  ${districts.join(", ")}`);
  console.log(`  uid        ${uid}`);

  if (password) {
    console.log(`\n  password   ${password}`);
    console.log("\n  Shown once. Send it over a channel you trust and have them");
    console.log("  change it. Re-run this command to issue a new one.");
  } else {
    console.log("\n  Password unchanged. Any signed-in sessions have been ended.");
  }
  console.log();
}

main().catch((error) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
