import type { GradeBand } from "./models";
import type { Negotiation, NegotiationMessage } from "./negotiation";

/**
 * A negotiation as it travels over the wire.
 *
 * JSON has no Date, so every timestamp goes as an ISO string and is revived on
 * the other side. Doing that in one place rather than at each call site means
 * a field added to the thread cannot be quietly dropped by a serialiser that
 * nobody remembered to update — the types here fail to compile instead.
 *
 * Shared by the server that streams and the client that listens, so this
 * module carries no `server-only` and imports nothing from Firebase.
 */

export interface WireMessage {
  readonly id: string;
  readonly author: NegotiationMessage["author"];
  readonly kind: NegotiationMessage["kind"];
  readonly phraseId?: string;
  readonly text?: string;
  readonly locale?: string;
  readonly bands?: readonly GradeBand[];
  readonly expiresAt?: string;
  readonly sentAt: string;
}

export interface WireNegotiation {
  readonly id: string;
  readonly listingId: string;
  readonly produceName: string;
  readonly farmerId: string;
  readonly buyerId: string;
  readonly farmerName: string;
  readonly buyerName: string;
  readonly quantity: number;
  readonly unit: Negotiation["unit"];
  readonly status: Negotiation["status"];
  readonly messages: readonly WireMessage[];
  readonly openedAt: string;
  readonly agreedBands?: readonly GradeBand[];
  readonly agreedAt?: string;
}

export function toWire(negotiation: Negotiation): WireNegotiation {
  return {
    id: negotiation.id,
    listingId: negotiation.listingId,
    produceName: negotiation.produceName,
    farmerId: negotiation.farmerId,
    buyerId: negotiation.buyerId,
    farmerName: negotiation.farmerName,
    buyerName: negotiation.buyerName,
    quantity: negotiation.quantity,
    unit: negotiation.unit,
    status: negotiation.status,
    openedAt: negotiation.openedAt.toISOString(),
    agreedBands: negotiation.agreedBands,
    agreedAt: negotiation.agreedAt?.toISOString(),
    messages: negotiation.messages.map((m) => ({
      id: m.id,
      author: m.author,
      kind: m.kind,
      phraseId: m.phraseId,
      text: m.text,
      locale: m.locale,
      bands: m.bands,
      expiresAt: m.expiresAt?.toISOString(),
      sentAt: m.sentAt.toISOString(),
    })),
  };
}

export function fromWire(wire: WireNegotiation): Negotiation {
  return {
    ...wire,
    openedAt: new Date(wire.openedAt),
    agreedAt: wire.agreedAt ? new Date(wire.agreedAt) : undefined,
    messages: wire.messages.map((m) => ({
      ...m,
      expiresAt: m.expiresAt ? new Date(m.expiresAt) : undefined,
      sentAt: new Date(m.sentAt),
    })),
  };
}
