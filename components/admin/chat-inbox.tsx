"use client";

import { MessageCircleIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { STANDARD_REPLIES } from "@/lib/domain/chat-replies";
import { cn } from "@/lib/utils";

/**
 * Every conversation, and the one being answered.
 *
 * A list beside a thread rather than a table of rows to click into: an operator
 * working the chat is answering several at once, and a page transition between
 * each one loses their place in the list every time.
 */

export interface InboxMessage {
  readonly id: string;
  readonly author: "visitor" | "operations" | "system";
  readonly body: string;
  readonly at: string;
}

export interface InboxThread {
  readonly id: string;
  readonly name?: string;
  readonly mobile?: string;
  readonly accountId?: string;
  readonly lastAt: string;
  /** Absent when the newest word is theirs, which is what makes it work. */
  readonly answeredAt?: string;
  readonly messages: readonly InboxMessage[];
}

export function ChatInbox({ threads }: { threads: readonly InboxThread[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState(threads[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  const current = threads.find((thread) => thread.id === openId) ?? threads[0];

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={MessageCircleIcon}
        tone="done"
        title="Nobody has written in"
        description="Questions from the public site arrive here. Somebody asking out of hours gets an automatic reply telling them when you will read it."
        className="m-6"
      />
    );
  }

  /**
   * Send either a typed message or a standard reply.
   *
   * A standard reply goes as an id rather than as its text: the visitor reads
   * it in their own language, which typed text cannot do. That is the whole
   * reason to prefer one where it fits.
   */
  async function send(replyId?: string) {
    const body = draft.trim();
    if (!current) return;
    if (!replyId && !body) return;

    const response = await fetch(`/api/chat/${current.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(replyId ? { replyId } : { message: body }),
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(detail.error ?? "Could not send that.");
      return;
    }

    setDraft("");
    // The thread is rendered on the server; refreshing is what shows the reply
    // in place rather than optimistically drawing a message that might not have
    // been written.
    start(() => router.refresh());
  }

  return (
    <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[20rem_1fr]">
      <ul className="divide-y overflow-y-auto border-b lg:max-h-[calc(100dvh-8rem)] lg:border-r lg:border-b-0">
        {threads.map((thread) => {
          const waiting = !thread.answeredAt;
          const last = thread.messages.at(-1);

          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => setOpenId(thread.id)}
                className={cn(
                  "hover:bg-accent/50 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                  thread.id === current?.id && "bg-accent",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {thread.name ?? thread.accountId ?? "Someone on the site"}
                  </span>
                  {waiting ? (
                    <span className="bg-warning text-warning-foreground ml-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium">
                      waiting
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {last?.body ?? "No messages"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {current ? (
        <div className="flex min-h-[24rem] flex-col">
          <div className="flex items-baseline justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">
              {current.name ?? current.accountId ?? "Someone on the site"}
            </span>
            {current.mobile ? (
              <a
                href={`tel:+91${current.mobile}`}
                className="text-primary text-xs hover:underline"
              >
                {current.mobile}
              </a>
            ) : (
              <span className="text-faint text-xs">No number given</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {current.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "mb-2 flex",
                  message.author === "operations"
                    ? "justify-end"
                    : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    message.author === "operations"
                      ? "bg-primary text-primary-foreground"
                      : message.author === "system"
                        ? "bg-muted text-muted-foreground border border-dashed"
                        : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {message.body}
                </div>
              </div>
            ))}
          </div>

          {/*
            Ten answers that cover most of what gets asked, and the only ones
            that arrive in the reader's language — a Tamil visitor sees the
            Tamil version of whichever is picked, without anybody translating
            anything.
          */}
          <div className="flex flex-wrap gap-1.5 border-t px-3 pt-3">
            {STANDARD_REPLIES.map((reply) => (
              <button
                key={reply.id}
                type="button"
                disabled={pending}
                onClick={() => void send(reply.id)}
                title={reply.text.en}
                className="border-border hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
              >
                {reply.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 border-t p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="Reply"
              aria-label="Your reply"
              className="border-input bg-background focus-visible:ring-ring min-h-16 flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
            <Button
              onClick={() => void send()}
              disabled={pending || !draft.trim()}
              size="icon"
              aria-label="Send"
            >
              <SendIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
