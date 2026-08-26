import { requireRole } from "@/lib/api/write-guard";
import { findSlot, toDate, validateAd } from "@/lib/domain/ad";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { record } from "@/lib/firebase/audit-write";

/**
 * Change or remove one placement.
 *
 * PATCH takes the whole creative rather than a field at a time. A placement is
 * validated as a whole — a section band needs an image, a button needs a link —
 * and a per-field patch would let a valid ad be walked into an invalid one one
 * request at a time, each of which passes on its own.
 *
 * The exception is `active`, which arrives on its own and is exactly the
 * pause-and-resume switch operations reaches for. Turning something off must
 * never be blocked by a validation error in the copy: the reason it is being
 * turned off may well *be* the copy.
 */

async function load(id: string) {
  const ref = adminDb().collection("ads").doc(id);
  const snapshot = await ref.get();
  return snapshot.exists ? { ref, data: snapshot.data() ?? {} } : null;
}

export async function PATCH(request: Request, context: RouteContext<"/api/ads/[id]">) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const existing = await load(id);
  if (!existing) return Response.json({ error: "No such placement." }, { status: 404 });

  const now = new Date();
  const actor = {
    accountId: gate.session.claims.accountId,
    role: "admin" as const,
    name: gate.session.email ?? "Operations",
  };

  // The switch on its own. See the note above on why this skips validation.
  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    await existing.ref.update({ active: body.active });
    await record({
      action: "ad.changed",
      actor,
      subject: { kind: "ad", id },
      from: existing.data.active === true ? "Live" : "Paused",
      to: body.active ? "Live" : "Paused",
      at: now,
    });
    return Response.json({ id, active: body.active });
  }

  const check = validateAd(body);
  if (!check.ok) return Response.json({ error: check.errors.join(" ") }, { status: 422 });

  const slot = findSlot(String(body.slotId))!;
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
    // Whatever it was. Editing the copy of a live placement does not take it
    // down, and editing a paused one does not put it up.
    active: existing.data.active === true,
  };

  await existing.ref.update(doc);

  // The old image, once nothing points at it. Left behind it is a file nobody
  // can reach and nobody will ever delete, in a bucket that is billed monthly.
  const previous = existing.data.imagePath;
  if (typeof previous === "string" && previous !== "" && previous !== doc.imagePath) {
    // Never the reason a save fails: the placement is already updated, and a
    // storage object that outlives its ad costs pennies, not correctness.
    await adminStorage()
      .file(previous)
      .delete()
      .catch(() => {});
  }

  await record({
    action: "ad.changed",
    actor,
    subject: { kind: "ad", id },
    to: slot.label,
    note: `${doc.name} for ${doc.advertiser}`,
    at: now,
  });

  return Response.json({ id, ...doc });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/ads/[id]">) {
  const gate = await requireRole("admin");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const existing = await load(id);
  if (!existing) return Response.json({ error: "No such placement." }, { status: 404 });

  await existing.ref.delete();

  const image = existing.data.imagePath;
  if (typeof image === "string" && image !== "") {
    await adminStorage()
      .file(image)
      .delete()
      .catch(() => {});
  }

  await record({
    action: "ad.removed",
    actor: {
      accountId: gate.session.claims.accountId,
      role: "admin",
      name: gate.session.email ?? "Operations",
    },
    subject: { kind: "ad", id },
    from: typeof existing.data.name === "string" ? existing.data.name : id,
    at: new Date(),
  });

  return Response.json({ id, removed: true });
}
