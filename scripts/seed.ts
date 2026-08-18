/**
 * Seeds Firestore from the mock data the consoles already render.
 *
 *   npm run seed
 *
 * Idempotent: every document is written with a known id via `set()`, so
 * running it twice updates rather than duplicating. It never deletes — a
 * document removed from the mocks lingers until someone removes it
 * deliberately, which is the safer failure for a script that talks to a real
 * project.
 *
 * Uses the Admin SDK, so Security Rules do not apply. That is the point:
 * rules deny all client writes, and this is a server tool.
 *
 * Dates are written as native `Date`, which the Admin SDK converts to
 * Firestore timestamps. Money is written as `{ minorUnits, currency }` —
 * integer paise, never a float, exactly as it is held in the domain.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import {
  agencies,
  buyerAccounts,
  driverAccounts,
  farmerAccounts,
  vehicles,
  workers,
} from "./seed-data/roster";
import { CATALOGUE } from "@/lib/mock/catalogue";
import { openListings } from "@/lib/mock/listings";
import { GEOGRAPHY } from "@/lib/mock/locations";
import { stockOffers } from "@/lib/mock/market";
import { negotiations } from "@/lib/mock/negotiations";
import { BARGAIN_VOCABULARY } from "@/lib/domain/bargain-vocabulary";
import { DOCUMENT_RULES, PACKS, PHRASES } from "@/lib/mock/reference";
import { DEFAULT_POLICY, POLICY_DOC_ID } from "@/lib/domain/policy";
import { buyerOrders } from "@/lib/mock/orders";

/* -------------------------------------------------------------------------
   Credentials
   ------------------------------------------------------------------------- */

/** Minimal .env reader — a standalone script does not get Next's loader. */
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function serviceAccount(): ServiceAccount {
  const env = { ...loadEnv(resolve(process.cwd(), ".env.local")), ...process.env };
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Seeding writes to the real project and needs Admin credentials.",
    );
  }

  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

/* -------------------------------------------------------------------------
   Writing
   ------------------------------------------------------------------------- */

/**
 * Firestore rejects `undefined`, and several documents legitimately have no
 * expiry — a PAN card and an RC do not lapse.
 *
 * Normalised to `null` rather than turning on `ignoreUndefinedProperties`,
 * which would silently drop the field instead. `null` says "this does not
 * expire", which is the actual fact, and it can be queried for; a missing
 * field cannot.
 */
function shapeDocuments(
  documents: readonly {
    kind: string;
    reference: string;
    expiresAt?: Date;
    verifiedAt?: Date;
  }[],
) {
  return documents.map((d) => ({
    kind: d.kind,
    reference: d.reference,
    expiresAt: d.expiresAt ?? null,
    verifiedAt: d.verifiedAt ?? null,
  }));
}

/**
 * Writes a collection in batches.
 *
 * Firestore caps a batch at 500 operations. Nothing here comes close, but the
 * chunking stays so a grown catalogue does not fail loudly a year from now.
 */
async function writeAll<T>(
  db: Firestore,
  collection: string,
  rows: readonly T[],
  id: (row: T) => string,
  shape: (row: T) => Record<string, unknown>,
): Promise<number> {
  const CHUNK = 400;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + CHUNK)) {
      batch.set(db.collection(collection).doc(id(row)), shape(row), {
        merge: true,
      });
    }
    await batch.commit();
  }

  console.log(`  ${collection.padEnd(18)} ${String(rows.length).padStart(3)} documents`);
  return rows.length;
}

/* -------------------------------------------------------------------------
   Seed
   ------------------------------------------------------------------------- */

async function main() {
  const account = serviceAccount();
  const app = initializeApp({ credential: cert(account), projectId: account.projectId });
  const db = getFirestore(app);

  console.log(`Seeding ${account.projectId}\n`);

  const now = new Date();
  let total = 0;

  /* Reference data ------------------------------------------------------- */

  total += await writeAll(
    db,
    "produce",
    Object.values(CATALOGUE),
    (c) => c.id,
    (c) => ({
      names: c.names,
      regional: c.regional ?? {},
      grading: c.grading ?? {},
      emoji: c.emoji,
      iconUrl: c.iconUrl ?? null,
      defaultUnit: c.defaultUnit,
      shelfLifeHours: c.shelfLifeHours ?? null,
      active: c.active ?? true,
    }),
  );

  // Geography: state → district → place. Every location field on the platform
  // reads from these three collections.
  total += await writeAll(
    db,
    "states",
    GEOGRAPHY.states,
    (s) => s.id,
    (s) => ({
      name: s.name,
      nativeName: s.nativeName,
      locale: s.locale,
      vehiclePrefix: s.vehiclePrefix,
      active: s.active,
    }),
  );

  total += await writeAll(
    db,
    "districts",
    GEOGRAPHY.districts,
    (d) => d.id,
    (d) => ({
      stateId: d.stateId,
      name: d.name,
      nativeName: d.nativeName ?? null,
      minOrderValue: d.minOrderValue ?? null,
      active: d.active,
    }),
  );

  total += await writeAll(
    db,
    "places",
    GEOGRAPHY.places,
    (p) => p.id,
    (p) => ({
      districtId: p.districtId,
      name: p.name,
      nativeName: p.nativeName ?? null,
      pincode: p.pincode,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      farmerCount: p.farmerCount,
      active: p.active,
    }),
  );

  total += await writeAll(
    db,
    "packs",
    PACKS,
    (p) => p.id,
    (p) => ({
      unit: p.unit,
      container: p.container,
      packSize: p.packSize,
      label: p.label,
      active: p.active,
    }),
  );

  total += await writeAll(
    db,
    "phrases",
    PHRASES,
    (p) => p.id,
    (p) => ({
      kind: p.kind,
      event: p.event,
      channel: p.channel,
      audience: p.audience,
      text: p.text,
      active: p.active,
    }),
  );

  // What either side may say while bargaining. Seeded so operations have
  // something to edit rather than a blank table, and so the bargaining screens
  // work on a fresh project before anyone opens Controls.
  total += await writeAll(
    db,
    "bargainPhrases",
    BARGAIN_VOCABULARY,
    (p) => p.id,
    (p) => ({
      text: p.text,
      speaker: p.speaker,
      topic: p.topic,
      active: p.active,
    }),
  );

  total += await writeAll(
    db,
    "documentRules",
    DOCUMENT_RULES,
    (r) => r.id,
    (r) => ({
      stateId: r.stateId,
      subject: r.subject,
      required: r.required,
      active: r.active,
    }),
  );

  // The policy singleton. Written with `create`-like semantics on purpose:
  // re-seeding must not stamp a tuned value back to the shipped default, which
  // is exactly what a blind `set()` would do to a number someone changed last
  // week from the Controls page.
  const policyRef = db.collection("settings").doc(POLICY_DOC_ID);
  if ((await policyRef.get()).exists) {
    console.log(`  ${"settings".padEnd(20)}kept existing policy`);
  } else {
    await policyRef.set({ ...DEFAULT_POLICY, createdAt: now });
    total += 1;
    console.log(`  ${"settings".padEnd(20)} 1 document`);
  }

  /* Accounts ------------------------------------------------------------- */

  total += await writeAll(
    db,
    "farmers",
    farmerAccounts(now),
    (f) => f.id,
    (f) => ({
      name: f.name,
      mobile: f.mobile,
      village: f.village,
      district: f.district,
      bankAccountTail: f.bankAccountTail,
      status: f.status,
      registeredAt: f.registeredAt,
      registeredBy: f.registeredBy,
      activeListings: f.activeListings,
      completedOrders: f.completedOrders,
      photoUrl: f.photoUrl ?? null,
      landPhotoUrl: f.landPhotoUrl ?? null,
      documents: shapeDocuments(f.documents),
    }),
  );

  total += await writeAll(
    db,
    "buyers",
    buyerAccounts(now),
    (b) => b.id,
    (b) => ({
      name: b.name,
      kind: b.kind,
      contactName: b.contactName,
      mobile: b.mobile,
      town: b.town,
      district: b.district,
      districts: b.districts,
      status: b.status,
      registeredAt: b.registeredAt,
      ordersPlaced: b.ordersPlaced,
      lifetimeValue: b.lifetimeValue,
      photoUrl: b.photoUrl ?? null,
      documents: shapeDocuments(b.documents),
    }),
  );

  // Agencies before the people and vehicles that belong to them, so a partial
  // run never leaves a worker pointing at an agency that is not there yet.
  total += await writeAll(
    db,
    "agencies",
    agencies(now),
    (a) => a.id,
    (a) => ({
      name: a.name,
      services: a.services,
      contactName: a.contactName,
      mobile: a.mobile,
      email: a.email,
      district: a.district,
      town: a.town,
      districts: a.districts,
      status: a.status,
      registeredAt: a.registeredAt,
      photoUrl: a.photoUrl ?? null,
      documents: shapeDocuments(a.documents),
    }),
  );

  total += await writeAll(
    db,
    "workers",
    workers(now),
    (w) => w.id,
    (w) => ({
      agencyId: w.agencyId,
      name: w.name,
      mobile: w.mobile,
      district: w.district,
      place: w.place,
      skills: w.skills,
      basis: w.basis,
      rate: w.rate,
      status: w.status,
      registeredAt: w.registeredAt,
      jobsCompleted: w.jobsCompleted,
      available: w.available,
      photoUrl: w.photoUrl ?? null,
      documents: shapeDocuments(w.documents),
    }),
  );

  total += await writeAll(
    db,
    "drivers",
    driverAccounts(now),
    (d) => d.id,
    (d) => ({
      agencyId: d.agencyId,
      name: d.name,
      mobile: d.mobile,
      district: d.district,
      status: d.status,
      registeredAt: d.registeredAt,
      tripsCompleted: d.tripsCompleted,
      assignedVehicle: d.assignedVehicle ?? null,
      photoUrl: d.photoUrl ?? null,
      documents: shapeDocuments(d.documents),
    }),
  );

  total += await writeAll(
    db,
    "vehicles",
    vehicles(now),
    (v) => v.id,
    (v) => ({
      agencyId: v.agencyId,
      registration: v.registration,
      type: v.type,
      capacityKg: v.capacityKg,
      owner: v.owner,
      district: v.district,
      status: v.status,
      registeredAt: v.registeredAt,
      assignedDriver: v.assignedDriver ?? null,
      refrigerated: v.refrigerated,
      photoUrl: v.photoUrl ?? null,
      documents: shapeDocuments(v.documents),
    }),
  );

  /* Trade ---------------------------------------------------------------- */

  // Flattened for querying: rules and indexes filter on `district` and
  // `farmerId`, and neither can reach into a nested object cheaply.
  total += await writeAll(
    db,
    "listings",
    openListings(now),
    (l) => l.id,
    (l) => ({
      // Demo data, and labelled as such. The buyers' market filters on this so
      // a real buyer never bargains for produce that does not exist and a
      // farmer who cannot be telephoned.
      seeded: true,
      produceId: l.produce.id,
      farmerId: l.farmer.id,
      farmerName: l.farmer.name,
      village: l.farmer.village,
      district: l.farmer.district,
      quantity: l.quantity,
      unit: l.unit,
      status: l.status,
      createdAt: l.createdAt,
      photoCount: l.photoCount,
      pendingSync: l.pendingSync,
      marketRate: l.marketRate,
      offer: l.offer ?? null,
    }),
  );

  total += await writeAll(
    db,
    "stock",
    stockOffers(now),
    (s) => s.id,
    (s) => ({
      produceId: s.sku.produce.id,
      skuId: s.sku.id,
      grade: s.sku.grade,
      unit: s.sku.unit,
      packSize: s.sku.packSize,
      packLabel: s.sku.packLabel,
      // Pickup is at the farm: the place is where the vehicle stops, the
      // district is the run it belongs to.
      placeId: s.placeId,
      place: s.place,
      districtId: s.source.districtId,
      district: s.source.district,
      pricePerUnit: s.pricePerUnit,
      availableQuantity: s.availableQuantity,
      minOrderQuantity: s.minOrderQuantity,
      gradedAt: s.gradedAt,
      bestBefore: s.bestBefore,
    }),
  );

  total += await writeAll(
    db,
    "buyerOrders",
    buyerOrders(now),
    (o) => o.id,
    (o) => ({
      reference: o.reference,
      // Every seeded order belongs to the demo buyer.
      buyerId: "B-1001",
      buyerName: o.buyerName,
      status: o.status,
      placedAt: o.placedAt,
      districtId: o.districtId,
      district: o.district,
      // Villages the vehicle calls at — pickup is at the farm.
      stops: o.stops,
      distanceKm: o.distanceKm,
      lines: o.lines,
      paidAt: o.paidAt ?? null,
      vehicleRegistration: o.vehicleRegistration ?? null,
      driverName: o.driverName ?? null,
      expectedArrival: o.expectedArrival ?? null,
      deliveredAt: o.deliveredAt ?? null,
      refundedAt: o.refundedAt ?? null,
    }),
  );

  // Messages ride on the negotiation document rather than a subcollection. A
  // bargain is a handful of messages, and keeping them together means the
  // thread is one read and an append is one atomic write — no risk of a
  // proposal landing without the guard having seen the message before it.
  total += await writeAll(
    db,
    "negotiations",
    negotiations(now.getTime()),
    (n) => n.id,
    (n) => ({
      listingId: n.listingId,
      produceName: n.produceName,
      farmerId: n.farmerId,
      buyerId: n.buyerId,
      farmerName: n.farmerName,
      buyerName: n.buyerName,
      quantity: n.quantity,
      unit: n.unit,
      status: n.status,
      openedAt: n.openedAt,
      agreedBands: n.agreedBands ?? null,
      agreedAt: n.agreedAt ?? null,
      messages: n.messages.map((m) => ({
        id: m.id,
        author: m.author,
        kind: m.kind,
        text: m.text ?? null,
        locale: m.locale ?? null,
        bands: m.bands ?? null,
        expiresAt: m.expiresAt ?? null,
        sentAt: m.sentAt,
      })),
    }),
  );

  console.log(`\n${total} documents written to ${account.projectId}.`);
  console.log(
    "Timestamps are relative to the seed run, so re-seed to refresh the demo clock.",
  );
}

main().catch((error) => {
  console.error("\nSeed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
