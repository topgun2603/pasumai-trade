import { cookies } from "next/headers";

import { verifySession } from "@/lib/auth/session";
import {
  automaticReply,
  ChatError,
  cleanMessage,
  openingMessage,
  type ChatThread,
} from "@/lib/domain/chat";
import { appendMessage, readThread } from "@/lib/firebase/chat-store";
import { readPlatformPolicy } from "@/lib/firebase/controls-read";

/**
 * The visitor half of the chat.
 *
 * The second unauthenticated write endpoint on the platform, and written as
 * defensively as the first. What it will not do:
 *
 *   - **take a thread id from the body.** The id is the only thing identifying
 *     a conversation, so one supplied by the caller is a way to read and write
 *     somebody else's. It comes from an httpOnly cookie this route sets.
 *   - **let a visitor speak as operations.** The author is decided here, never
 *     sent.
 *
 * What it deliberately lacks, like signup, is a limit on how many *threads* one
 * person may open — there is no shared counter to hold it, and an in-memory one
 * resets per instance. Per-thread caps are in `lib/domain/chat.ts`; the rest
 * wants App Check or an edge rule, in one place for both endpoints.
 */

const COOKIE = "pasumai_chat";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** What the browser is allowed to know about a thread. */
function forVisitor(thread: ChatThread) {
  return {
    id: thread.id,
    messages: thread.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      at: m.at.toISOString(),
    })),
  };
}

/** The conversation so far, plus the greeting when there is nothing yet. */
export async function GET() {
  const [store, policy] = await Promise.all([cookies(), readPlatformPolicy()]);
  const now = new Date();
  const id = store.get(COOKIE)?.value;
  const thread = id ? await readThread(id) : null;

  return Response.json({
    thread: thread ? forVisitor(thread) : null,
    greeting: openingMessage(policy, now),
  });
}

export async function POST(request: Request) {
  let body: { message?: unknown; name?: unknown; mobile?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  let text: string;
  try {
    text = cleanMessage(body.message);
  } catch (error) {
    const code = error instanceof ChatError ? error.code : "invalid";
    return Response.json(
      { error: (error as Error).message, code },
      { status: 422 },
    );
  }

  const [store, policy, session] = await Promise.all([
    cookies(),
    readPlatformPolicy(),
    // A signed-in person gets their account attached, so operations knows who
    // they are without asking. A visitor simply has none.
    verifySession(),
  ]);

  const now = new Date();
  const existingId = store.get(COOKIE)?.value;

  let result;
  try {
    result = await appendMessage(existingId, "visitor", text, now, {
      name:
        typeof body.name === "string"
          ? body.name.trim().slice(0, 80)
          : undefined,
      mobile:
        typeof body.mobile === "string"
          ? body.mobile.trim().slice(0, 20)
          : undefined,
      accountId: session?.claims.accountId,
    });
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: 429 },
      );
    }
    return Response.json({ error: "Could not send that." }, { status: 500 });
  }

  /*
    The automatic reply goes on the thread, not just down the wire. Operations
    should see exactly what the person was told — including, when it was out of
    hours, the promise about when somebody would read it.
  */
  const answered = await appendMessage(
    result.thread.id,
    "system",
    automaticReply(policy, now),
    new Date(now.getTime() + 1),
  );

  if (result.created) {
    store.set(COOKIE, result.thread.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return Response.json(
    { thread: forVisitor(answered.thread) },
    { status: 201 },
  );
}
