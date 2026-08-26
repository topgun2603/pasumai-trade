import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/api/write-guard";
import { isImageType, MAX_IMAGE_BYTES } from "@/lib/domain/listing-draft";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * A signed URL for one ad creative.
 *
 * The same shape as /api/uploads — the bytes go browser to bucket and never
 * through a Vercel function, and the path is composed here rather than taken
 * from the request. What differs is the gate and the folder: operations only,
 * and always under `ads/`, so a creative can never be written over a farmer's
 * listing photograph.
 *
 * No video. A section band autoplaying somebody's thirty-second advertisement
 * on a village connection is the kind of thing that gets a site closed rather
 * than read, and nothing on the page is built to render one.
 */

/** Long enough for a large creative on a slow connection, short enough to be worthless if leaked. */
const URL_TTL_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  let body: { contentType?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const bytes = typeof body.bytes === "number" ? body.bytes : Number.NaN;

  if (!contentType || !Number.isFinite(bytes) || bytes <= 0) {
    return Response.json({ error: "Say what you are uploading." }, { status: 422 });
  }
  if (!isImageType(contentType)) {
    return Response.json(
      { error: `${contentType} is not an image type we can take.` },
      { status: 422 },
    );
  }
  if (bytes > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: "That image is too large. Export it at web size and try again." },
      { status: 422 },
    );
  }

  const extension = contentType.split("/")[1] ?? "bin";
  const path = `ads/${randomUUID()}.${extension}`;
  const object = adminStorage().file(path);

  const [url] = await object.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + URL_TTL_MS,
    contentType,
  });

  // The path is what gets stored on the ad; the URL is spent on this one PUT
  // and is worthless afterwards.
  return Response.json({ url, path, contentType });
}
