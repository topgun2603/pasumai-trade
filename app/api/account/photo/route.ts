import { randomUUID } from "node:crypto";

import { requireSession } from "@/lib/api/write-guard";
import { COLLECTION_FOR_SIGNUP, type SignupRole } from "@/lib/domain/signup";
import { adminDb, adminStorage, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Changing the photograph on an account that already exists.
 *
 * Separate from `/api/auth/profile/upload`, which admits a session that has
 * proved a handset and has *no* role — the photograph taken during
 * registration, before there is an account to attach it to. That endpoint
 * cannot serve this one: a signed-in user with a role is exactly who it turns
 * away.
 *
 * Two steps, because the file goes to storage directly rather than through
 * this server. `POST` hands back a signed URL to PUT the bytes to; `PATCH`
 * records the path on the account once the upload has finished. Nothing is
 * written to the account until the bytes are actually there, so an upload that
 * fails halfway leaves the old photograph in place.
 *
 * The path is composed here and never taken from the request. `PATCH` checks
 * the path it is given sits under this account's own folder — otherwise a
 * request naming somebody else's file would point this account at their
 * photograph, which is both a privacy leak and a way to impersonate them in
 * every list an operator reads.
 */

/** Long enough to send a photograph on a village connection. */
const URL_TTL_MS = 15 * 60 * 1000;

/** One portrait. Bigger than this is a mistake, not a better photograph. */
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Which collection this session's account lives in. */
function collectionFor(role: string): string | null {
  if (role === "admin") return null;
  const known = COLLECTION_FOR_SIGNUP[role as SignupRole];
  return known ?? null;
}

function folder(accountId: string): string {
  return `accounts/${accountId}/portrait/`;
}

export async function POST(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { accountId, role } = gate.session.claims;
  if (!accountId || !collectionFor(role)) {
    // Operations hold no account record, so there is no portrait to change.
    return Response.json({ error: "This sign-in has no account." }, { status: 403 });
  }

  let body: { contentType?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const contentType =
    typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  const bytes = typeof body.bytes === "number" ? body.bytes : NaN;

  // Images only. A PDF here is either a mistake or somebody using the account
  // page as free file hosting.
  if (!EXTENSION[contentType]) {
    return Response.json({ error: "Choose a photograph." }, { status: 422 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_BYTES) {
    return Response.json(
      {
        error:
          "That photograph is too large. One from a phone camera is well under the limit.",
      },
      { status: 422 },
    );
  }

  const path = `${folder(accountId)}${randomUUID()}.${EXTENSION[contentType]}`;

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

export async function PATCH(request: Request) {
  if (!hasAdminCredentials()) {
    return Response.json({ error: "Uploads are not configured." }, { status: 503 });
  }

  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { accountId, role } = gate.session.claims;
  const collection = collectionFor(role);
  if (!accountId || !collection) {
    return Response.json({ error: "This sign-in has no account." }, { status: 403 });
  }

  let body: { path?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path : "";
  if (!path.startsWith(folder(accountId))) {
    return Response.json(
      { error: "That upload does not belong to this account.", code: "foreignUpload" },
      { status: 403 },
    );
  }

  // The bytes have to be there. Recording a path to an object that never
  // finished uploading is how an account ends up with a portrait that is
  // permanently a broken image.
  const [exists] = await adminStorage().file(path).exists();
  if (!exists) {
    return Response.json(
      { error: "The photograph did not finish uploading. Try again." },
      { status: 409 },
    );
  }

  await adminDb().collection(collection).doc(accountId).update({ photoUrl: path });

  return Response.json({ ok: true });
}
