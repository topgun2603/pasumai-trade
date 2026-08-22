import { cookies } from "next/headers";

import { verifySession } from "@/lib/auth/session";
import {
  automaticReply,
  ChatError,
  checkDetails,
  cleanMessage,
  openingMessage,
  type ChatThread,
} from "@/lib/domain/chat";
import { replyText } from "@/lib/domain/chat-replies";
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

/**
 * What the browser is allowed to know about a thread.
 *
 * Standard replies are rendered into the thread's language here rather than
 * shipped as an id the widget has to resolve — the widget would then need all
 * six translations in its bundle to display one of them.
 */
function forVisitor(thread: ChatThread) {
  return {
    id: thread.id,
    name: thread.name,
    messages: thread.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: replyText(m.replyId, thread.locale, m.body),
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
  let details: ReturnType<typeof checkDetails>["values"] | undefined;

  /*
    Name and number are required to *start* a thread and ignored afterwards.
    They are already on it, and taking them from every message would let
    somebody rewrite whose conversation it is halfway through.
  */
  const existing = existingId ? await readThread(existingId) : null;
  if (!existing) {
    const checked = checkDetails(body);
    if (Object.keys(checked.errors).length > 0) {
      return Response.json(
        {
          error: "We need a name and a number to answer you.",
          fields: checked.errors,
        },
        { status: 422 },
      );
    }
    details = checked.values;
  }

  let result;
  try {
    result = await appendMessage(existing?.id, "visitor", text, now, {
      details,
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
