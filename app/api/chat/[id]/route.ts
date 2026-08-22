import { requireConsole } from "@/lib/auth/require";
import { ChatError, cleanMessage } from "@/lib/domain/chat";
import { standardReply } from "@/lib/domain/chat-replies";
import { appendMessage } from "@/lib/firebase/chat-store";

/**
 * Operations answering a thread.
 *
 * Separate from the visitor route and gated on the admin role, because these
 * are two different things wearing the same word. The visitor endpoint takes no
 * thread id and decides the author itself; this one takes an id — an operator
 * legitimately answers any thread — and writes as `operations`.
 *
 * Keeping them apart is what stops a visitor posting as operations by guessing
 * a parameter, which is exactly what one route with an `author` field would
 * invite.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/chat/[id]">,
) {
  await requireConsole(["admin"]);

  const { id } = await context.params;
  if (!id) return Response.json({ error: "Which thread?" }, { status: 422 });

  let body: { message?: unknown; replyId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  /*
    A standard reply is sent as an id, not as text.

    The English goes on the message as the body — it is the record of what the
    operator sent, and the inbox reads it — while the id is what lets the
    visitor's side render the same answer in their own language. An unknown id
    is refused rather than quietly falling back, because it would ship a reply
    nobody wrote.
  */
  const replyId = typeof body.replyId === "string" ? body.replyId : "";
  const canned = replyId ? standardReply(replyId) : undefined;
  if (replyId && !canned) {
    return Response.json(
      { error: "No such standard reply.", code: "unknownReply" },
      { status: 422 },
    );
  }

  let text: string;
  try {
    text = canned ? canned.text.en : cleanMessage(body.message);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 422 });
  }

  try {
    const { thread } = await appendMessage(id, "operations", text, new Date(), {
      replyId: canned?.id,
    });
    return Response.json({ sent: thread.messages.length });
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }
    return Response.json({ error: "Could not send that." }, { status: 500 });
  }
}
