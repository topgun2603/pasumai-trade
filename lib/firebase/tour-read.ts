import "server-only";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Whether somebody has already been shown their console tour.
 *
 * Stored on `accounts/{accountId}` rather than on the farmer, buyer or agency
 * document, for one reason: that document belongs to whichever collection the
 * role happens to live in, and transport and manpower share one. This is a fact
 * about a *login*, not about a business, and `accounts` is already where
 * per-login things live — notifications and push tokens are both under it.
 *
 * Not a custom claim, tempting as it looks: claims are up to an hour stale, so
 * a tour finished now would keep reappearing until the token refreshed.
 *
 * Not a cookie either, though it would be free. A farmer who signs in on a
 * borrowed handset and again on their own would be taught twice, and one who
 * clears their browser would be taught again — the flag belongs to the person,
 * not the device.
 */

/** Tours this account has finished or skipped. */
export async function readSeenTours(accountId: string): Promise<Set<string>> {
  if (!accountId || !hasAdminCredentials()) return new Set();

  try {
    const snapshot = await adminDb()
      .collection("accounts")
      .doc(accountId)
      .get();
    const seen = snapshot.data()?.toursSeen;
    if (!seen || typeof seen !== "object") return new Set();

    return new Set(Object.keys(seen as Record<string, unknown>));
  } catch {
    /*
      A failed read means the tour shows. That is the right way round: showing a
      tour twice is a small annoyance, and swallowing it on a bad connection
      would leave a first-time farmer with an unexplained console.
    */
    return new Set();
  }
}
