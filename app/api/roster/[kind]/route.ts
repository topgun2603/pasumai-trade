import { requireSession } from "@/lib/api/write-guard";
import {
  buildRosterRecord,
  isRosterKind,
  ROSTER,
  RosterError,
  type Attachment,
} from "@/lib/domain/roster-write";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Filing a vehicle, a driver or a crew member.
 *
 * One route for the three because the differences are all in the shaping, and
 * the parts that must not vary — who is asking, whose agency it lands under,
 * what status it starts at — are exactly the parts worth writing once.
 *
 * The agency id comes from the session and is never read from the body. A
 * body-supplied one would let any signed-in agency file a lorry under a
 * competitor's name, or read a competitor's back.
 */

/** Enough that an agency cannot paper the collection from a loop. */
const CEILING = 500;

export async function POST(
  request: Request,
  context: RouteContext<"/api/roster/[kind]">,
) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { kind } = await context.params;
  if (!isRosterKind(kind)) {
    return Response.json({ error: "Unknown record.", code: "unknownKind" }, { status: 422 });
  }

  const definition = ROSTER[kind];
  const { role, accountId } = gate.session.claims;

  if (!accountId) {
    return Response.json({ error: "This session has no agency.", code: "noAccount" }, { status: 403 });
  }
  if (role !== definition.role) {
    return Response.json(
      {
        error: `Only a ${definition.role} agency can file a ${definition.one.toLowerCase()}.`,
        code: "wrongService",
      },
      { status: 403 },
    );
  }

  let body: { values?: unknown; files?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const values = body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : {};

  /*
    Only paths this account could have been given. The upload endpoint composes
    every path as `roster/{accountId}/…`, so anything else was either invented
    or copied from another agency — and a record pointing at somebody else's
    document is how one agency comes to read another's.
  */
  const files: Record<string, Attachment | undefined> = {};
  const claimed = body.files && typeof body.files === "object" ? (body.files as Record<string, unknown>) : {};
  for (const [slot, value] of Object.entries(claimed)) {
    if (!value || typeof value !== "object") continue;
    const file = value as Record<string, unknown>;
    const path = typeof file.path === "string" ? file.path : "";
    const contentType = typeof file.contentType === "string" ? file.contentType : "";
    if (!path.startsWith(`roster/${accountId}/${kind}/`)) {
      return Response.json(
        { error: "That upload does not belong to this account.", code: "foreignUpload" },
        { status: 403 },
      );
    }
    files[slot] = { path, contentType };
  }

  const db = adminDb();

  let record: Record<string, unknown>;
  try {
    record = buildRosterRecord({ kind, values, files }, accountId, new Date());
  } catch (error) {
    if (error instanceof RosterError) {
      return Response.json({ error: error.message, fields: error.fields }, { status: 422 });
    }
    // `maskAadhaar` throws its own for a malformed number, and the message it
    // carries is the one the person needs to read.
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not file that." },
      { status: 422 },
    );
  }

  const mine = db.collection(definition.collection).where("agencyId", "==", accountId);
  const held = await mine.count().get();
  if (held.data().count >= CEILING) {
    return Response.json(
      { error: `This agency already holds ${CEILING} records of that kind.`, code: "tooMany" },
      { status: 429 },
    );
  }

  /*
    A registration is unique to a lorry, and two records for one plate means
    dispatch can send a vehicle that is already out. Scoped to this agency: two
    agencies cannot hold the same plate either, but that is a platform-wide
    check operations makes at verification, not one to make an agency fail a
    form over somebody else's data.
  */
  if (kind === "vehicles") {
    const registration = record.registration as string;
    const clash = await mine.where("registration", "==", registration).limit(1).get();
    if (!clash.empty) {
      return Response.json(
        {
          error: `${registration} is already on your fleet.`,
          fields: { registration: "This vehicle is already registered" },
        },
        { status: 409 },
      );
    }
  }

  const reference = db.collection(definition.collection).doc();
  await reference.set(record);

  return Response.json({ id: reference.id, kind, status: "pending" }, { status: 201 });
}
