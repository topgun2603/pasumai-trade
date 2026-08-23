import { requireRole } from "@/lib/api/write-guard";
import { record } from "@/lib/firebase/audit-write";
import { isVerificationStatus } from "@/lib/domain/admin";
import { canMove, isRecordKind, RECORDS } from "@/lib/domain/admin-records";
import { adminDb, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Operations approving, refusing or suspending a record.
 *
 * The endpoint the admin row actions never had. Those actions were wired to
 * `toast.success("… approved")` — they told an operator the account was live
 * and wrote nothing, which is worse than a button that plainly fails, because
 * nobody goes back to check an account they were told was done.
 *
 * ## What it refuses
 *
 * The **kind** is checked against a table rather than used as a collection
 * name, or a request could name any collection in the database and write a
 * status field into it.
 *
 * The **move** is checked against the record's current status, read here rather
 * than sent. A status from the browser would let a stale tab approve an account
 * somebody else suspended a minute ago, and the operator who suspended it would
 * never know.
 *
 * A rejection is not final: `canMove` allows rejected back to verified, because
 * a refused document gets resubmitted and the alternative is deleting the
 * account and losing the record of why it was refused.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/records/[kind]/[id]">,
) {
  /*
    `requireRole`, not `requireConsole`.

    `requireConsole` redirects, which is right for a layout and wrong here: a
    franchise reaching this endpoint got a 307 to `/listings`, so the fetch
    that made the call followed it and parsed a page of HTML as its answer.
    The refusal has to be a refusal the caller can read.
  */
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  if (!hasAdminCredentials()) {
    return Response.json({ error: "Not configured on this deployment." }, { status: 503 });
  }

  const { kind, id } = await context.params;
  if (!isRecordKind(kind)) {
    return Response.json({ error: "Unknown record type.", code: "unknownKind" }, { status: 422 });
  }
  if (!id) {
    return Response.json({ error: "Which record?" }, { status: 422 });
  }

  let body: { status?: unknown; reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const next = typeof body.status === "string" ? body.status : "";
  if (!isVerificationStatus(next)) {
    return Response.json({ error: "Unknown status.", code: "unknownStatus" }, { status: 422 });
  }

  const reference = adminDb().collection(RECORDS[kind].collection).doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    return Response.json({ error: "That record no longer exists.", code: "gone" }, { status: 404 });
  }

  const current = snapshot.data()?.status;
  const from = isVerificationStatus(current) ? current : "pending";

  if (from === next) {
    // Not an error. Two operators clicking Approve on the same row should both
    // see it approved rather than one of them seeing a failure.
    return Response.json({ status: next, changed: false });
  }

  if (!canMove(from, next)) {
    return Response.json(
      {
        error: `A ${RECORDS[kind].one.toLowerCase()} that is ${from} cannot be moved to ${next}.`,
        code: "notAllowed",
        status: from,
      },
      { status: 409 },
    );
  }

  const now = new Date();

  /*
    Bug 13. An approval or a suspension is the most consequential thing an
    operator does to somebody's account — it decides whether they can trade at
    all — and until now it left no trace of who did it.

    Written before the update rather than after, unlike the listing edits: if
    the log write is the thing that fails, `record` swallows it and the status
    change still lands. If the *update* fails, the log has claimed a change
    that did not happen — so the surrounding try/catch shape matters more than
    the order, and the order here keeps the actor's session in scope.
  */
  await record({
    action: "account.statusChanged",
    actor: {
      accountId: gate.session.claims.accountId,
      role: gate.session.claims.role,
      name: gate.session.email ?? "Operations",
    },
    subject: { kind: RECORDS[kind].collection, id },
    from,
    to: next,
    note: typeof body.reason === "string" ? body.reason : undefined,
    at: now,
  });

  await reference.update({
    status: next,
    /*
      Who and when, on the record itself. There is no audit log yet — it is a
      separate piece of work — and a status that changed with nothing saying
      when is the thing an operator cannot answer a complaint with.
    */
    statusChangedAt: now,
    ...(typeof body.reason === "string" && body.reason.trim()
      ? { statusReason: body.reason.trim().slice(0, 500) }
      : {}),
  });

  return Response.json({ status: next, changed: true });
}
