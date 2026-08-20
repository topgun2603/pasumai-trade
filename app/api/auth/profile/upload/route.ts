import { randomUUID } from "node:crypto";

import { readPendingSession } from "@/lib/auth/session";
import { adminStorage, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * A signed URL for the photograph somebody takes while registering.
 *
 * Reachable by a session that has verified a handset and has no role yet, which
 * is the whole point — the photograph is taken *before* the account exists, so
 * none of the other upload endpoints will admit them.
 *
 * The path is composed here and never taken from the request, and it is keyed
 * on the uid rather than an account id, because at this moment there is no
 * account. The profile endpoint checks the same prefix before storing it.
 */

/** Long enough to take and send a photograph on a village connection. */
const URL_TTL_MS = 15 * 60 * 1000;

/** One portrait. Bigger than this is a mistake, not a better photograph. */
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const session = await readPendingSession();
  if (!session) {
    return Response.json(
      { error: "Verify your mobile number first.", code: "notVerified" },
      { status: 401 },
    );
  }

  let body: { contentType?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  const bytes = typeof body.bytes === "number" ? body.bytes : NaN;

  // Images only. This is a portrait, and a PDF here is either a mistake or
  // somebody using registration as free file hosting.
  if (!EXTENSION[contentType]) {
    return Response.json({ error: "Take or choose a photograph." }, { status: 422 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return Response.json(
      { error: "That photograph is too large. One from a phone camera is well under the limit." },
      { status: 422 },
    );
  }

  const path = `profiles/${session.uid}/${randomUUID()}.${EXTENSION[contentType]}`;

  const [url] = await adminStorage()
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + URL_TTL_MS,
      contentType,
    });

  return Response.json({ path, url, contentType });
}
