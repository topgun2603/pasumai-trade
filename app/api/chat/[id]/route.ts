import { requireConsole } from "@/lib/auth/require";
import { ChatError, cleanMessage } from "@/lib/domain/chat";
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
export async function POST(request: Request, context: RouteContext<"/api/chat/[id]">) {
  await requireConsole(["admin"]);

  const { id } = await context.params;
  if (!id) return Response.json({ error: "Which thread?" }, { status: 422 });

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  let text: string;
  try {
    text = cleanMessage(body.message);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 422 });
  }

  try {
    const { thread } = await appendMessage(id, "operations", text, new Date());
    return Response.json({ sent: thread.messages.length });
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return Response.json({ error: "Could not send that." }, { status: 500 });
  }
}
