import { requireRole } from "@/lib/api/write-guard";
import { isRole, type Role } from "@/lib/auth/claims";
import {
  approve,
  KycError,
  kycState,
  reject,
  type Check,
  type CheckKind,
} from "@/lib/domain/kyc";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { adminDb } from "@/lib/firebase/admin";
import { readChecks, serialiseChecks } from "@/lib/firebase/kyc-read";

/**
 * Operations approving or refusing a manual check.
 *
 * The only route in the platform that can turn a manual submission into a
 * verified one, and it is `admin`-only. The domain refuses the two things that
 * would make the audit trail a lie: approving an eKYC result (nobody
 * overrides UIDAI on a hunch) and rejecting one that is already verified
 * (which is a suspension, a different act with different consequences).
 *
 * When the last required check clears, the account's `status` becomes
 * `verified` in the same write. Two documents disagreeing about whether
 * somebody is verified is the bug this avoids by never having two.
 */
export async function POST(request: Request) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const kind = typeof body.kind === "string" ? (body.kind as CheckKind) : undefined;
  const decision = body.decision === "reject" ? "reject" : "approve";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!isRole(role) || !canSelfSignup(role) || !accountId || !kind) {
    return Response.json({ error: "Give a role, an account id and a check." }, { status: 422 });
  }
  if (decision === "reject" && !reason) {
    // A refusal with no reason is a refusal the person cannot act on, and they
    // will phone to ask — which costs more than typing it did.
    return Response.json({ error: "Say why it was refused." }, { status: 422 });
  }

  const existing = await readChecks(role as Role, accountId);
  const check = existing.find((c) => c.kind === kind);
  if (!check) {
    return Response.json({ error: "No such check on that account." }, { status: 404 });
  }

  const operator = gate.session.email ?? gate.session.uid;
  const now = new Date();

  let updated: Check;
  try {
    updated = decision === "approve" ? approve(check, operator, now) : reject(check, operator, reason, now);
  } catch (error) {
    if (error instanceof KycError) {
      // The domain's refusal is written to be read by the operator who tried
      // it, so it goes back as-is.
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const checks: Check[] = [...existing.filter((c) => c.kind !== kind), updated];
  const state = kycState(checks, role as Role);

  const write: Record<string, unknown> = { kyc: serialiseChecks(checks) };

  // The account's own status follows from its checks. Only these two states
  // move it: everything else leaves the account where it was, because "one
  // check approved out of four" is not a verified business.
  if (state === "verified") {
    write.status = "verified";
    write.verifiedAt = now;
  } else if (state === "rejected") {
    write.status = "rejected";
  }

  await adminDb()
    .collection(COLLECTION_FOR_SIGNUP[role])
    .doc(accountId)
    .set(write, { merge: true });

  return Response.json({
    accountId,
    kind,
    state: updated.state,
    kycState: state,
    accountStatus: write.status ?? "unchanged",
  });
}
