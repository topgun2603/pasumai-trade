import "server-only";

import type { DispatchStatus } from "@/lib/domain/dispatch-request";

import { adminDb } from "./admin";

/**
 * What transport has been arranged, keyed by bargain.
 *
 * Stored on the negotiation rather than in a collection of its own: a dispatch
 * request has no life apart from the bargain it belongs to, and every screen
 * that shows one has already loaded the other.
 */
export interface StoredTransport {
  readonly agencyName: string;
  readonly status: DispatchStatus;
  readonly reason?: string;
}

const STATUSES: DispatchStatus[] = ["requested", "accepted", "declined", "cancelled"];

export async function readTransport(): Promise<Record<string, StoredTransport>> {
  const snapshot = await adminDb().collection("negotiations").get();
  const out: Record<string, StoredTransport> = {};

  for (const doc of snapshot.docs) {
    const raw = doc.data().transport as Record<string, unknown> | undefined;
    if (!raw) continue;

    const status = raw.status;
    // An unreadable status is dropped rather than defaulted. Defaulting to
    // "accepted" would tell a farmer a lorry is coming that is not.
    if (typeof status !== "string" || !STATUSES.includes(status as DispatchStatus)) continue;

    out[doc.id] = {
      agencyName: typeof raw.agencyName === "string" ? raw.agencyName : "Agency",
      status: status as DispatchStatus,
      reason: typeof raw.reason === "string" ? raw.reason : undefined,
    };
  }

  return out;
}
