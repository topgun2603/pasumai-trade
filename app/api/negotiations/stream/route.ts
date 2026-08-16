import { requireSession } from "@/lib/api/write-guard";
import { canSelfSignup } from "@/lib/domain/signup";
import { toWire } from "@/lib/domain/negotiation-wire";
import { adminDb } from "@/lib/firebase/admin";
import { shapeNegotiation } from "@/lib/firebase/negotiations-read";

/**
 * Bargains, live.
 *
 * Server-sent events rather than a client Firestore listener, and that is a
 * decision about where the session lives. The browser signs in with
 * `inMemoryPersistence` so the httpOnly cookie stays the single source of
 * truth — which means the page holds no Firebase auth at all, and an
 * `onSnapshot` from the browser would arrive unauthenticated and be refused by
 * Security Rules. The alternative was to give the client a persistent Firebase
 * session, reintroducing exactly the second notion of "signed in" that the
 * cookie exists to avoid.
 *
 * So the listener runs here, on Admin credentials, behind the same session
 * check as everything else, and the browser gets a one-way stream it is
 * already authenticated for. `EventSource` sends the cookie on its own and
 * reconnects by itself.
 *
 * One query per role. A farmer's threads are the ones with their id in
 * `farmerId`; a buyer's are in `buyerId`. Never both — Firestore cannot OR
 * across fields in one query, and a person is only ever one side of a trade.
 */

export const dynamic = "force-dynamic";

/**
 * Just under a minute.
 *
 * Serverless platforms cap how long a function may run, and a stream killed
 * mid-flight looks to the browser like a network error. Closing deliberately
 * before that lets `EventSource` do what it does anyway — reconnect — and the
 * reconnect carries a fresh snapshot, so nothing is missed in the gap.
 */
const STREAM_MS = 50_000;

/** Comment frames, to stop a proxy deciding an idle connection is dead. */
const HEARTBEAT_MS = 20_000;

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const { role, accountId } = gate.session.claims;
  if (!accountId || !canSelfSignup(role)) {
    return Response.json({ error: "No bargains on this account." }, { status: 403 });
  }

  // Which side of the trade this account is on. Operations do not stream:
  // they may read a bargain, and watching one live is not a thing they do.
  const field = role === "farmer" ? "farmerId" : "buyerId";
  if (role !== "farmer" && role !== "buyer" && role !== "franchise") {
    return Response.json({ error: "No bargains on this account." }, { status: 403 });
  }

  const query = adminDb().collection("negotiations").where(field, "==", accountId);

  const encoder = new TextEncoder();

  // Declared before the stream, not after: `start` runs synchronously inside
  // the constructor, so assigning to a `let` declared below it would hit the
  // temporal dead zone and throw on the first connection.
  let finish: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // The client went away between the check and the write. Nothing to
          // do but stop.
          closed = true;
        }
      };

      const unsubscribe = query.onSnapshot(
        (snapshot) => {
          send(
            "threads",
            snapshot.docs.map((doc) => toWire(shapeNegotiation(doc.id, doc.data()))),
          );
        },
        (error) => {
          console.error("negotiation stream failed", error);
          send("error", { message: "The live connection dropped. Reconnecting." });
          finish();
        },
      );

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      const timer = setTimeout(() => finish(), STREAM_MS);

      finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(timer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };
    },

    // A browser that navigates away. Without this the Firestore listener and
    // the heartbeat would outlive the request that opened them.
    cancel() {
      finish();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // No buffering anywhere between here and the browser, or events arrive
      // in a clump when the connection closes instead of as they happen.
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
