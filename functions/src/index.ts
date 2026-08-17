import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  onDocumentCreated,
  onDocumentWritten,
} from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import {
  forBargain,
  forListing,
  forOrder,
} from "../../lib/domain/notification-events";
import {
  bargainMessageKey,
  listingKey,
  orderKey,
  transportKey,
} from "../../lib/domain/notification-key";
import { notify } from "./notify";
import { TRIGGER_OPTIONS } from "./region";

/**
 * Notifications, written where the events happen.
 *
 * Every one of these watches a document rather than being called by the
 * application, and that is the whole argument for putting them here. The
 * platform has several paths that settle a bargain — the console, a script, an
 * operator fixing something by hand — and a notification raised by the caller
 * is one that goes missing the first time somebody uses a different path. The
 * document changing is the event; nothing else is.
 *
 * These files are adapters and nothing more: read the event, fetch what the
 * rule needs, write what it returns. The rules themselves are in `events.ts`,
 * where they can be tested without a Firestore.
 *
 * Read `region.ts` before touching the deploy region. These are Eventarc
 * triggers and cannot be put wherever we like.
 *
 * Two properties the platform's own specification demands of every handler:
 *
 *  - **Idempotent.** Delivery is at least once, so a handler may run twice for
 *    one write. Deduplication is by event id, in `notify`.
 *  - **Order-independent.** Delivery order is not guaranteed, so nothing here
 *    reasons about what came before beyond the `before`/`after` snapshots the
 *    event itself carries.
 */

initializeApp();

/** A farmer posted a lot; buyers covering that district hear about it. */
export const onProduceListed = onDocumentCreated(
  { ...TRIGGER_OPTIONS, document: "listings/{listingId}" },
  async (event) => {
    const listing = event.data?.data();
    if (!listing) return;

    const db = getFirestore();
    const farmerId = String(listing.farmerId ?? "");
    if (!farmerId) return;

    // The district lives on the farmer, not on the listing.
    const farmer = await db.collection("farmers").doc(farmerId).get();
    const district = farmer.exists ? String(farmer.data()?.district ?? "") : "";

    if (!district) {
      logger.warn("listing has no district; nobody notified", {
        listingId: event.params.listingId,
        farmerId,
      });
      return;
    }

    const buyers = await db
      .collection("buyers")
      .where("districts", "array-contains", district)
      .get();

    await notify(
      forListing({
        listing,
        listingId: event.params.listingId,
        farmerName: String(farmer.data()?.name ?? ""),
        buyerIds: buyers.docs.map((doc) => doc.id),
      }).map((draft) => ({
        ...draft,
        id: listingKey(event.params.listingId, draft.accountId),
      })),
    );
  },
);

/**
 * Everything that happens inside a bargain.
 *
 * One trigger rather than several, because a single write can be more than one
 * thing — accepting appends a message *and* settles the thread — and separate
 * triggers on the same document would each fire and each notify.
 */
export const onBargainActivity = onDocumentWritten(
  { ...TRIGGER_OPTIONS, document: "negotiations/{negotiationId}" },
  async (event) => {
    const after = event.data?.after.data();
    const messages = Array.isArray(after?.messages) ? after.messages.length : 0;
    const negotiationId = event.params.negotiationId;

    await notify(
      forBargain({
        before: event.data?.before.data(),
        after,
        negotiationId,
      }).map((draft) => ({
        ...draft,
        // Transport is not a message, so it is keyed on the bargain rather
        // than on a message count that did not change.
        id:
          draft.kind === "transportArranged"
            ? transportKey(negotiationId, draft.accountId)
            : bargainMessageKey(negotiationId, messages, draft.accountId),
      })),
    );
  },
);

/** An order was placed against agreed rates; the farmer is told. */
export const onOrderPlaced = onDocumentCreated(
  { ...TRIGGER_OPTIONS, document: "buyerOrders/{orderId}" },
  async (event) => {
    const order = event.data?.data();
    if (!order) return;

    await notify(
      forOrder({ order, orderId: event.params.orderId }).map((draft) => ({
        ...draft,
        id: orderKey(event.params.orderId, draft.accountId),
      })),
    );
  },
);
