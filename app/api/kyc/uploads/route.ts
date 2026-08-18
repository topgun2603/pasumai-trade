import { randomUUID } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import {
  MAX_DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  isDocumentType,
  type CheckKind,
} from "@/lib/domain/kyc";
import { canSelfSignup } from "@/lib/domain/signup";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Signed URLs so an applicant can upload their documents straight to storage.
 *
 * Separate from `/api/uploads`, which looks similar and is not: that one is
 * gated by `postListing` and refuses everybody who is not a farmer with a live
 * subscription. Verification documents are uploaded by five kinds of account,
 * before any of them has paid for anything — routing them through the listing
 * endpoint would mean a buyer could not prove who they were until they had
 * bought something.
 *
 * The bytes do not pass through this server, for the same reason as listings: a
 * Vercel function takes at most a 4.5 MB body, and a modern phone camera
 * produces files close enough to that to matter.
 *
 * **The path is composed here and never taken from the request.** A
 * client-chosen path is a client that can write over somebody else's identity
 * documents — or read them back, since the reader signs whatever path the
 * record holds.
 */

/** Long enough for a photograph on a village connection; short enough to be worthless if leaked. */
const URL_TTL_MS = 15 * 60 * 1000;

const KINDS: CheckKind[] = ["identity", "pan", "gst", "bank", "fssai"];

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

interface Requested {
  contentType: string;
  bytes: number;
}

function read(value: unknown): Requested | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const contentType = typeof v.contentType === "string" ? v.contentType.toLowerCase() : "";
  const bytes = typeof v.bytes === "number" ? v.bytes : NaN;
  if (!contentType || !Number.isFinite(bytes) || bytes <= 0) return null;
  return { contentType, bytes };
}

export async function POST(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!canSelfSignup(role) || !accountId) {
    return Response.json({ error: "This account does not need KYC." }, { status: 403 });
  }

  let body: { kind?: unknown; files?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const kind = body.kind as CheckKind;
  if (!KINDS.includes(kind)) {
    return Response.json({ error: "Unknown check." }, { status: 422 });
  }

  const requested = Array.isArray(body.files) ? body.files.map(read) : null;
  if (!requested || requested.length === 0 || requested.some((f) => f === null)) {
    return Response.json({ error: "Say what you are uploading." }, { status: 422 });
  }
  const files = requested as Requested[];

  if (files.length > MAX_DOCUMENTS) {
    return Response.json(
      { error: `Up to ${MAX_DOCUMENTS} files for one document.` },
      { status: 422 },
    );
  }

  for (const file of files) {
    if (!isDocumentType(file.contentType)) {
      return Response.json(
        { error: "Upload a photograph or a PDF." },
        { status: 422 },
      );
    }
    if (file.bytes > MAX_DOCUMENT_BYTES) {
      return Response.json(
        {
          error:
            "That file is too large. A photograph from a phone camera is well under the limit.",
        },
        { status: 422 },
      );
    }
  }

  const bucket = adminStorage();
  const expires = Date.now() + URL_TTL_MS;

  const uploads = await Promise.all(
    files.map(async (file) => {
      // Scoped to the account and the check. An applicant cannot write into
      // another account's folder, because they never get to choose the path.
      const path = `kyc/${accountId}/${kind}/${randomUUID()}.${EXTENSION[file.contentType] ?? "bin"}`;

      const [url] = await bucket.file(path).getSignedUrl({
        version: "v4",
        action: "write",
        expires,
        contentType: file.contentType,
      });

      return { path, url, contentType: file.contentType };
    }),
  );

  return Response.json({ uploads, expiresAt: new Date(expires).toISOString() });
}
