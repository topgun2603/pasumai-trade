import { randomUUID } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import { ATTACHMENTS, isRosterKind, ROSTER } from "@/lib/domain/roster-write";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Signed URLs so an agency can upload a lorry's papers straight to storage.
 *
 * The third of these on the platform, and separate for the same reason the
 * second was: `/api/uploads` is gated by `postListing` and refuses anybody who
 * is not a paying farmer, and `/api/kyc/uploads` writes under `kyc/{account}`,
 * which is the folder operations reads identity documents from. A permit is
 * neither.
 *
 * **The path is composed here and never taken from the request.** A
 * client-chosen path is an agency that can write over another agency's
 * documents — or read them back, since anything reading these signs whatever
 * path the record holds.
 */

/** Long enough for a photograph on a village connection, short enough to be worthless if leaked. */
const URL_TTL_MS = 15 * 60 * 1000;

/** One document, photographed front and back at most, plus room for a retry. */
const MAX_FILES = 8;

const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

interface Requested {
  slot: string;
  contentType: string;
  bytes: number;
}

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!accountId) {
    return Response.json({ error: "This session has no agency.", code: "noAccount" }, { status: 403 });
  }

  let body: { kind?: unknown; files?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!isRosterKind(kind)) {
    return Response.json({ error: "Unknown record.", code: "unknownKind" }, { status: 422 });
  }

  // Transport files lorries and drivers; manpower files crew. Checked here as
  // well as on the write, because this endpoint alone decides whose folder a
  // browser is handed permission to write into.
  if (role !== ROSTER[kind].role) {
    return Response.json(
      { error: `Only a ${ROSTER[kind].role} agency can file a ${ROSTER[kind].one.toLowerCase()}.`, code: "wrongService" },
      { status: 403 },
    );
  }

  const slots = ATTACHMENTS[kind];
  const raw = Array.isArray(body.files) ? body.files : [];
  if (raw.length === 0 || raw.length > MAX_FILES) {
    return Response.json({ error: "Say what you are uploading." }, { status: 422 });
  }

  const files: Requested[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      return Response.json({ error: "Say what you are uploading." }, { status: 422 });
    }
    const value = entry as Record<string, unknown>;
    const slot = typeof value.slot === "string" ? value.slot : "";
    const contentType = typeof value.contentType === "string" ? value.contentType.toLowerCase() : "";
    const bytes = typeof value.bytes === "number" ? value.bytes : NaN;

    // The slot names the document, and the slot is part of the path — so it is
    // checked against the list this kind actually has rather than accepted.
    if (!(slot in slots)) {
      return Response.json({ error: `A ${ROSTER[kind].one.toLowerCase()} has no ${slot || "such"} document.` }, { status: 422 });
    }
    if (!EXTENSION[contentType]) {
      return Response.json({ error: "Upload a photograph or a PDF." }, { status: 422 });
    }
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
      return Response.json(
        { error: "That file is too large. A photograph from a phone camera is well under the limit." },
        { status: 422 },
      );
    }

    files.push({ slot, contentType, bytes });
  }

  const bucket = adminStorage();
  const expires = Date.now() + URL_TTL_MS;

  const uploads = await Promise.all(
    files.map(async (file) => {
      const path = `roster/${accountId}/${kind}/${file.slot}/${randomUUID()}.${EXTENSION[file.contentType]}`;

      const [url] = await bucket.file(path).getSignedUrl({
        version: "v4",
        action: "write",
        expires,
        contentType: file.contentType,
      });

      return { slot: file.slot, path, url, contentType: file.contentType };
    }),
  );

  return Response.json({ uploads });
}
