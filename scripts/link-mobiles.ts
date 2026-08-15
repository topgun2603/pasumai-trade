/**
 * Puts each account's mobile number onto its Firebase Auth user.
 *
 *   npx tsx scripts/link-mobiles.ts          # report only
 *   npx tsx scripts/link-mobiles.ts --apply  # write
 *
 * OTP sign-in works by Firebase matching an SMS to an existing user *by phone
 * number*. If the number is not on the user record, signing in by SMS mints a
 * second user with no role and no accountId, and the session exchange refuses
 * it — correctly, but confusingly.
 *
 * Signup sets the number at creation. This is for the accounts that existed
 * before it did, and for repairing one whose number changed in Firestore
 * without the auth record following.
 *
 * Dry by default. A script that rewrites auth records is not one to run and
 * find out.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { toE164 } from "@/lib/domain/registration";

/** Collections holding an account with a `mobile` field. */
const COLLECTIONS = ["farmers", "buyers", "agencies"] as const;

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
  const apply = process.argv.includes("--apply");
  initializeApp({ credential: cert(serviceAccount()) });
  const db = getFirestore();
  const auth = getAuth();

  // Every auth user, indexed by the accountId in their claims. Cheaper than a
  // lookup per account, and it also surfaces users whose claims point nowhere.
  const byAccount = new Map<string, { uid: string; phone?: string }>();
  let page = await auth.listUsers(1000);
  for (;;) {
    for (const user of page.users) {
      const accountId = (user.customClaims as { accountId?: string } | undefined)?.accountId;
      if (accountId) {
        byAccount.set(accountId, { uid: user.uid, phone: user.phoneNumber ?? undefined });
      }
    }
    if (!page.pageToken) break;
    page = await auth.listUsers(1000, page.pageToken);
  }

  let linked = 0;
  let already = 0;
  let skipped = 0;

  for (const collection of COLLECTIONS) {
    const snapshot = await db.collection(collection).get();

    for (const doc of snapshot.docs) {
      const mobile = doc.data().mobile;
      const user = byAccount.get(doc.id);

      if (!user) {
        console.log(`  – ${doc.id}: no sign-in yet`);
        skipped++;
        continue;
      }

      const e164 = typeof mobile === "string" ? toE164(mobile) : null;
      if (!e164) {
        console.log(`  ! ${doc.id}: mobile "${mobile}" is not a valid Indian number`);
        skipped++;
        continue;
      }

      if (user.phone === e164) {
        already++;
        continue;
      }

      if (!apply) {
        console.log(`  → ${doc.id}: would set ${e164}${user.phone ? ` (was ${user.phone})` : ""}`);
        linked++;
        continue;
      }

      try {
        await auth.updateUser(user.uid, { phoneNumber: e164 });
        console.log(`  ✓ ${doc.id}: ${e164}`);
        linked++;
      } catch (error) {
        // Almost always the number already sitting on a different user. Worth
        // naming rather than counting, because it means two accounts claim the
        // same phone and a person has to decide which.
        const code = (error as { code?: string }).code ?? String(error);
        console.log(`  ✗ ${doc.id}: ${e164} — ${code}`);
        skipped++;
      }
    }
  }

  console.log(
    `\n${apply ? "linked" : "would link"} ${linked}, already correct ${already}, skipped ${skipped}`,
  );
  if (!apply && linked > 0) console.log("Re-run with --apply to write.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
