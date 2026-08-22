"use client";

import { MessageCircleIcon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Ask operations something, without an account.
 *
 * What the enquiry form used to be, with the wait taken out. That form promised
 * a telephone call and then went quiet; this answers the moment somebody sends
 * — inside working hours by saying a person is reading, outside them by saying
 * when one will be. Either way the person deciding whether to register learns
 * something before they close the tab.
 *
 * The conversation is identified by an httpOnly cookie the server sets, so it
 * survives a reload and a visitor coming back tomorrow, and the browser never
 * holds the thread id in anything a person can edit.
 *
 * Polled rather than streamed. A chat that a handful of people use at once does
 * not need a socket per visitor, and polling every few seconds *only while the
 * window is open* costs nothing when nobody has it open — which is almost
 * always.
 */

interface Message {
  readonly id: string;
  readonly author: "visitor" | "operations" | "system";
  readonly body: string;
  readonly at: string;
}

/** Only while the window is open, and slow enough not to be a load generator. */
const POLL_MS = 5000;

export function ChatWidget({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [greeting, setGreeting] = useState("");
  const [draft, setDraft] = useState("");
  /*
    Asked once, before the first message, and never again — the server keeps
    them on the thread. Required because a chat answered only while somebody is
    still on the page is a chat that goes cold the moment they close the tab,
    and the number is what lets operations finish the conversation by telephone.
  */
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [known, setKnown] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const foot = useRef<HTMLDivElement>(null);

  /*
    Load and then poll, but only while the panel is open. The cleanup is what
    makes that true — without it, closing the window would leave the interval
    running for the life of the page.
  */
  useEffect(() => {
    if (!open) return;

    let alive = true;

    async function load() {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as {
          thread: { messages: Message[]; name?: string } | null;
          greeting: string;
        };
        if (!alive) return;
        setMessages(data.thread?.messages ?? []);
        setGreeting(data.greeting);
        // A thread already exists, so they have told us who they are.
        if (data.thread) setKnown(true);
      } catch {
        // A failed poll is not worth saying anything about; the next one is
        // five seconds away and the conversation on screen is still correct.
      }
    }

    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [open]);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    if (open) foot.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setProblem(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Name, number and language ride along; the server keeps them on the
        // first message and ignores them after that.
        body: JSON.stringify({ message: body, name, mobile, locale }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        thread?: { messages: Message[] };
        error?: string;
        fields?: Record<string, string>;
      };

      if (!response.ok) {
        setFields(data.fields ?? {});
        setProblem(data.error ?? "Could not send that.");
        return;
      }

      setFields({});
      setKnown(true);
      setMessages(data.thread?.messages ?? []);
      setDraft("");
    } catch {
      setProblem("Could not reach us. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed right-4 bottom-4 z-40 gap-2 rounded-full shadow-lg"
      >
        <MessageCircleIcon className="size-5" />
        Ask us
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Chat with operations"
      className="bg-popover text-popover-foreground fixed right-4 bottom-4 z-40 flex h-[min(30rem,calc(100dvh-2rem))] w-[min(23rem,calc(100vw-2rem))] flex-col rounded-xl border shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">Pasumai Trade</span>
          <span className="text-muted-foreground text-xs">We answer here</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && greeting ? (
          <Bubble author="system" body={greeting} />
        ) : null}
        {messages.map((message) => (
          <Bubble
            key={message.id}
            author={message.author}
            body={message.body}
          />
        ))}
        <div ref={foot} />
      </div>

      {problem ? (
        <p role="alert" className="text-destructive px-4 pb-2 text-xs">
          {problem}
        </p>
      ) : null}

      {known ? null : (
        <div className="grid gap-2 border-t px-3 pt-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="chat-name" className="text-xs">
              Your name
            </Label>
            <Input
              id="chat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fields.name)}
              className="h-8 text-sm"
            />
            {fields.name ? (
              <p className="text-destructive text-xs">{fields.name}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="chat-mobile" className="text-xs">
              Mobile
            </Label>
            <Input
              id="chat-mobile"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              aria-invalid={Boolean(fields.mobile)}
              className="h-8 text-sm"
            />
            {fields.mobile ? (
              <p className="text-destructive text-xs">{fields.mobile}</p>
            ) : null}
          </div>
        </div>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, shift-enter breaks the line — what every chat does,
            // and what a person will try without being told.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Type your question"
          aria-label="Your message"
          className="border-input bg-background focus-visible:ring-ring min-h-16 flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !draft.trim()}
          aria-label="Send"
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function Bubble({ author, body }: { author: Message["author"]; body: string }) {
  const mine = author === "visitor";

  return (
    <div className={cn("mb-2 flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          mine
            ? "bg-primary text-primary-foreground"
            : author === "system"
              ? // Visibly not a person. A automatic line dressed as an operator
                // is the fastest way to lose the trust the chat exists to build.
                "bg-muted text-muted-foreground border border-dashed"
              : "bg-secondary text-secondary-foreground",
        )}
      >
        {body}
      </div>
    </div>
  );
}
