import { randomUUID } from "node:crypto";

import { requireCapability } from "@/lib/api/capability";
import {
  isImageType,
  isVideoType,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_VIDEO_BYTES,
} from "@/lib/domain/listing-draft";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Signed URLs so the browser can upload straight to storage.
 *
 * The bytes deliberately do not pass through this server. A Vercel function
 * takes at most a 4.5 MB request body, and a thirty-second phone video is
 * routinely several times that — a proxied upload would work on every test
 * photograph and fail on the first real video. It would also double the
 * bandwidth bill for no benefit.
 *
 * So this issues short-lived signed PUT URLs and the browser uploads directly.
 * The credentials never leave the server; what leaves is permission to write
 * one named object, of one content type, for fifteen minutes.
 *
 * The path is composed here and never taken from the request. A client-chosen
 * path is a client that can overwrite somebody else's photographs, or write
 * outside its own folder entirely.
 */

/** Long enough for a video on a bad connection, short enough to be worthless if leaked. */
const URL_TTL_MS = 15 * 60 * 1000;

interface Requested {
  kind: "image" | "video";
  contentType: string;
  bytes: number;
}

function read(value: unknown): Requested | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const kind = v.kind === "video" ? "video" : "image";
  const contentType = typeof v.contentType === "string" ? v.contentType : "";
  const bytes = typeof v.bytes === "number" ? v.bytes : NaN;
  if (!contentType || !Number.isFinite(bytes) || bytes <= 0) return null;
  return { kind, contentType, bytes };
}

export async function POST(request: Request) {
  // Uploading is part of posting a listing, so it is gated by the same
  // capability — otherwise the paywall would have a hole in it shaped like a
  // free file host.
  const gate = await requireCapability("postListing", "farmer");
  if (!gate.ok) return gate.response;

  const accountId = gate.session.claims.accountId!;

  let body: { files?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const requested = Array.isArray(body.files) ? body.files.map(read) : null;
  if (!requested || requested.length === 0 || requested.some((f) => f === null)) {
    return Response.json({ error: "Say what you are uploading." }, { status: 422 });
  }
  const files = requested as Requested[];

  const images = files.filter((f) => f.kind === "image");
  const videos = files.filter((f) => f.kind === "video");

  if (images.length > MAX_IMAGES) {
    return Response.json({ error: `Up to ${MAX_IMAGES} photos.` }, { status: 422 });
  }
  if (videos.length > 1) {
    return Response.json({ error: "One video." }, { status: 422 });
  }

  for (const file of files) {
    const okType = file.kind === "image" ? isImageType(file.contentType) : isVideoType(file.contentType);
    if (!okType) {
      return Response.json(
        { error: `${file.contentType} is not a file type we can take.` },
        { status: 422 },
      );
    }
    const cap = file.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.bytes > cap) {
      return Response.json(
        {
          error:
            file.kind === "image"
              ? "That photo is too large. Most phone cameras are well under the limit."
              : "That video is too long or too large. Keep it to about thirty seconds.",
        },
        { status: 422 },
      );
    }
  }

  const bucket = adminStorage();
  const expires = Date.now() + URL_TTL_MS;

  const uploads = await Promise.all(
    files.map(async (file) => {
      const extension = file.contentType.split("/")[1]?.replace("quicktime", "mov") ?? "bin";
      // Scoped to the account, named by the server. A farmer cannot write into
      // another farmer's folder because they never get to choose the path.
      const path = `listings/${accountId}/${randomUUID()}.${extension}`;
      const object = bucket.file(path);

      const [url] = await object.getSignedUrl({
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
