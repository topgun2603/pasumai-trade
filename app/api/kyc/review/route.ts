import { requireRole } from "@/lib/api/write-guard";
import { isRole, type Role } from "@/lib/auth/claims";
import {
  approve,
  askForMore,
  askForReupload,
  KycError,
  kycState,
  reject,
  type Check,
  type CheckKind,
} from "@/lib/domain/kyc";
import { COLLECTION_FOR_SIGNUP, canSelfSignup } from "@/lib/domain/signup";
import { CHECK_LABELS } from "@/lib/domain/kyc";
import { notificationKey } from "@/lib/domain/notification-key";
import type { NotificationKind } from "@/lib/domain/notification";
import { adminDb } from "@/lib/firebase/admin";
import { writeNotifications } from "@/lib/firebase/notifications-write";
import { sendPushes } from "@/lib/firebase/push-send";

/** Where each role reads its own verification. */
const VERIFICATION_HREF: Record<string, string> = {
  farmer: "/farm/verification",
  buyer: "/verification",
  franchise: "/verification",
  transport: "/agency/verification",
  manpower: "/agency/verification",
};
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
  /*
    Four decisions, not two. Most of what comes back from a verification queue
    is neither yes nor no — a certificate in a slightly different company name,
    a photograph with a corner missing — and having only the two forced an
    operator to refuse somebody over something a sentence settles.
  */
  const DECISIONS = ["approve", "reject", "askMore", "askReupload"] as const;
  type Decision = (typeof DECISIONS)[number];

  const decision = (DECISIONS as readonly string[]).includes(String(body.decision))
    ? (body.decision as Decision)
    : "approve";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!isRole(role) || !canSelfSignup(role) || !accountId || !kind) {
    return Response.json({ error: "Give a role, an account id and a check." }, { status: 422 });
  }
  if (decision !== "approve" && !reason) {
    // Every decision except approval sends somebody away with something to do,
    // and one with no words is one they cannot act on. They will telephone to
    // ask, which costs more than typing it would have.
    return Response.json(
      {
        error:
          decision === "reject"
            ? "Say why it was refused."
            : decision === "askReupload"
              ? "Say what is wrong with the document — otherwise the same photograph comes back."
              : "Say what is needed.",
      },
      { status: 422 },
    );
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
    updated =
      decision === "approve"
        ? approve(check, operator, now)
        : decision === "reject"
          ? reject(check, operator, reason, now)
          : decision === "askMore"
            ? askForMore(check, operator, reason, now)
            : askForReupload(check, operator, reason, now);
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

  /*
    Tell them, in their own language, on every channel they have.

    The half that was missing: an operator asked for a clearer photograph and
    nothing reached the person it was asked of, so a queue filled with accounts
    waiting on people who had no idea they were being waited on.

    `accountVerified` is sent instead of the individual approval when the last
    check clears — being told "your PAN was approved" when what actually
    happened is that the account went live buries the news.
  */
  const NOTIFY: Partial<Record<Decision, NotificationKind>> = {
    approve: "checkApproved",
    reject: "checkRejected",
    askMore: "checkNeedsInfo",
    askReupload: "checkNeedsReupload",
  };

  const kindNotified: NotificationKind =
    state === "verified" ? "accountVerified" : (NOTIFY[decision] ?? "checkApproved");

  const drafts = [
    {
      id: notificationKey([accountId, "kyc", kind, updated.state], accountId),
      accountId,
      audience: (role === "farmer" ? "farmer" : "buyer") as "farmer" | "buyer",
      kind: kindNotified,
      subject: { counterparty: CHECK_LABELS[kind] },
      href: VERIFICATION_HREF[role] ?? "/verification",
    },
  ];

  await writeNotifications(drafts);
  await sendPushes(
    drafts.map((draft) => ({ ...draft, createdAt: now })),
    () => (role === "farmer" ? "ta" : "en"),
  );

  return Response.json({
    accountId,
    kind,
    state: updated.state,
    kycState: state,
    accountStatus: write.status ?? "unchanged",
  });
}
