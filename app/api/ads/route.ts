import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/api/write-guard";
import { findSlot, toDate, validateAd } from "@/lib/domain/ad";
import { record } from "@/lib/firebase/audit-write";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Book a placement.
 *
 * Operations only. Every field is copied out of the body by name — nothing
 * arrives from a request and lands in Firestore unread, which is the rule the
 * rest of the write endpoints follow and matters more here than most: this
 * document ends up rendered on the public landing page.
 */
export async function POST(request: Request) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const check = validateAd(body);
  if (!check.ok) return Response.json({ error: check.errors.join(" ") }, { status: 422 });

  const slot = findSlot(String(body.slotId))!;
  const id = randomUUID();
  const now = new Date();

  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const optional = (value: unknown) => {
    const trimmed = text(value);
    return trimmed === "" ? null : trimmed;
  };

  const doc = {
    name: text(body.name),
    advertiser: text(body.advertiser),
    slotId: slot.id,
    headline: text(body.headline),
    body: optional(body.body),
    imagePath: optional(body.imagePath),
    imageAlt: optional(body.imageAlt),
    ctaLabel: optional(body.ctaLabel),
    href: optional(body.href),
    locales: Array.isArray(body.locales) ? body.locales.filter((v) => typeof v === "string") : [],
    roles: Array.isArray(body.roles) ? body.roles.filter((v) => typeof v === "string") : [],
    startsAt: toDate(body.startsAt),
    endsAt: toDate(body.endsAt),
    weight: Math.round(Number(body.weight)),
    // A new placement starts paused. Somebody filling a form is composing, not
    // publishing, and the difference between the two is a live advertisement
    // on the front page while the copy is still half written.
    active: false,
    createdAt: now,
  };

  await adminDb().collection("ads").doc(id).set(doc);

  await record({
    action: "ad.placed",
    actor: {
      accountId: gate.session.claims.accountId,
      role: "admin",
      name: gate.session.email ?? "Operations",
    },
    subject: { kind: "ad", id },
    to: slot.label,
    note: `${doc.name} for ${doc.advertiser}`,
    at: now,
  });

  return Response.json({ id, ...doc }, { status: 201 });
}
