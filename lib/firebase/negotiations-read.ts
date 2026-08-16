import "server-only";

import type { GradeBand } from "@/lib/domain/models";
import type {
  Negotiation,
  NegotiationMessage,
} from "@/lib/domain/negotiation";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Reads bargains from Firestore, falling back to the mocks.
 *
 * Same contract as the controls reader: the caller is told whether it got live
 * data, and says so on screen. A negotiation screen that silently shows sample
 * threads while offering an Accept button would be worse than one that admits
 * it is not connected.
 */

/** Firestore hands back `Timestamp`; the domain wants `Date`. */
function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(0);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return toDate(value);
}

function toBands(value: unknown): readonly GradeBand[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((b) => b && typeof b.ratePerUnit === "number")
    .map((b) => ({
      grade: b.grade,
      ratePerUnit: b.ratePerUnit,
      // Absent on every band written before lots could be sold in parts, and
      // absent means the whole of that grade — so those read back unchanged.
      quantity: typeof b.quantity === "number" ? b.quantity : undefined,
    }));
}

export function shapeNegotiation(
  id: string,
  data: Record<string, unknown>,
): Negotiation {
  const rawMessages = Array.isArray(data.messages) ? data.messages : [];

  const messages: NegotiationMessage[] = rawMessages.map((m) => ({
    id: String(m.id),
    author: m.author,
    kind: m.kind,
    phraseId: m.phraseId ?? undefined,
    text: m.text ?? undefined,
    locale: m.locale ?? undefined,
    bands: toBands(m.bands),
    expiresAt: toOptionalDate(m.expiresAt),
    sentAt: toDate(m.sentAt),
  }));

  return {
    id,
    listingId: String(data.listingId ?? ""),
    produceName: String(data.produceName ?? ""),
    farmerId: String(data.farmerId ?? ""),
    buyerId: String(data.buyerId ?? ""),
    farmerName: String(data.farmerName ?? ""),
    buyerName: String(data.buyerName ?? ""),
    quantity: Number(data.quantity ?? 0),
    unit: (data.unit ?? "kg") as Negotiation["unit"],
    status: (data.status ?? "open") as Negotiation["status"],
    messages,
    openedAt: toDate(data.openedAt),
    agreedBands: toBands(data.agreedBands),
    agreedAt: toOptionalDate(data.agreedAt),
  };
}

export interface NegotiationsData {
  readonly threads: Negotiation[];
  readonly live: boolean;
}

export async function readNegotiations(
  fallback: Negotiation[],
): Promise<NegotiationsData> {
  if (!hasAdminCredentials()) return { threads: fallback, live: false };

  try {
    const snapshot = await adminDb().collection("negotiations").get();
    if (snapshot.empty) return { threads: fallback, live: false };

    const threads = snapshot.docs
      .map((doc) => shapeNegotiation(doc.id, doc.data()))
      // Open bargains first, then most recently spoken in. What is waiting on
      // a reply is what the buyer opened the screen for.
      .sort((a, b) => {
        const openness = Number(b.status === "open") - Number(a.status === "open");
        if (openness !== 0) return openness;
        const at = (n: Negotiation) =>
          n.messages.at(-1)?.sentAt.getTime() ?? n.openedAt.getTime();
        return at(b) - at(a);
      });

    return { threads, live: true };
  } catch {
    return { threads: fallback, live: false };
  }
}
