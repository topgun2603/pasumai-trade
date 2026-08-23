import "server-only";

import { adminStorage, hasAdminCredentials } from "@/lib/firebase/admin";

/**
 * Turning a stored portrait into something a browser can actually load.
 *
 * `photoUrl` on an account, driver, vehicle or worker holds a **storage path**
 * — `roster/AG-558B54/drivers/portrait/b536f38d….jpg` — not a URL. Every screen
 * that shows one hands it straight to `next/image`, which resolves it against
 * the app's own origin and gets a 404.
 *
 * Nobody noticed because the seeded demo rows store `/mock/portrait.svg`, which
 * *is* a real path under `public/`. So the fake portraits rendered and the real
 * ones did not, on the same screen, and the broken half looked like accounts
 * that simply had no photograph.
 *
 * Signed rather than made public. A portrait is a photograph of somebody who
 * did not agree to have it on the open internet, and a bucket made readable to
 * fix a rendering bug is a bucket that stays readable.
 *
 * Signing is local — the v4 signature is computed from the service-account key
 * with no round trip — so doing it per row in a list is cheap.
 */

/** An hour. Longer than any page is read, shorter than a link is worth sharing. */
const TTL_MS = 60 * 60 * 1000;

/**
 * Left alone: anything already loadable.
 *
 * `/mock/...` is a file under `public/`, and `http(s)://` is somebody's
 * already-hosted image. Signing either would break it.
 */
function alreadyLoadable(value: string): boolean {
  return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

/**
 * A URL for one stored portrait, or undefined if there is nothing to show.
 *
 * Never throws. A path pointing at an object that has since been deleted, or a
 * deployment with no credentials, yields no photograph — which renders as the
 * initials placeholder, the same as an account that never had one. A row that
 * fails to load its picture is not a reason to fail the page it sits on.
 */
export async function signedPhoto(value: unknown): Promise<string | undefined> {
  if (typeof value !== "string" || value === "") return undefined;
  if (alreadyLoadable(value)) return value;
  if (!hasAdminCredentials()) return undefined;

  try {
    const [url] = await adminStorage()
      .file(value)
      .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + TTL_MS });
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Sign the `photoUrl` on every row that has one.
 *
 * Applied at the one place every roster read passes through, rather than in
 * each of the eight `shape*` functions — those are synchronous, and making
 * them async to sign a URL would turn a shaping concern into an I/O one
 * everywhere they are called.
 *
 * Rows without the field come back untouched, so this is safe to run over any
 * collection.
 */
export async function withSignedPhotos<T>(rows: readonly T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (!row || typeof row !== "object" || !("photoUrl" in row)) return row;
      const photoUrl = await signedPhoto((row as { photoUrl?: unknown }).photoUrl);
      // The spread reproduces the row's own shape; `T` is preserved in
      // practice and the cast is what says so to the compiler.
      return { ...row, photoUrl } as T;
    }),
  );
}
