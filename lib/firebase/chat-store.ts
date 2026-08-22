import "server-only";

import { randomUUID } from "node:crypto";

import {
  ChatError,
  guardThread,
  type ChatAuthor,
  type ChatMessage,
  type ChatThread,
} from "@/lib/domain/chat";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * Chat threads, stored whole.
 *
 * Messages live in an array on the thread document rather than in a
 * subcollection, which is the opposite of how the notification feed is built
 * and right for the opposite reason: a thread is capped at sixty messages and
 * is always read entire, so one document is one read. A subcollection would be
 * a query per open window, several times a minute, for a conversation that fits
 * comfortably inside Firestore's document limit.
 */

const COLLECTION = "chatThreads";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const stamp = value as { toDate?: () => Date } | null;
  return typeof stamp?.toDate === "function" ? stamp.toDate() : new Date(0);
}

function shapeMessage(raw: unknown): ChatMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const m = raw as Record<string, unknown>;
  const author = m.author;
  if (author !== "visitor" && author !== "operations" && author !== "system")
    return [];
  if (typeof m.body !== "string" || !m.body) return [];

  return [
    {
      id: typeof m.id === "string" ? m.id : randomUUID(),
      author: author as ChatAuthor,
      body: m.body,
      at: toDate(m.at),
    },
  ];
}

function shapeThread(id: string, data: Record<string, unknown>): ChatThread {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

  return {
    id,
    name: str(data.name),
    mobile: str(data.mobile),
    accountId: str(data.accountId),
    startedAt: toDate(data.startedAt),
    lastAt: toDate(data.lastAt),
    answeredAt: data.answeredAt ? toDate(data.answeredAt) : undefined,
    messages: Array.isArray(data.messages)
      ? data.messages.flatMap(shapeMessage)
      : [],
  };
}

export async function readThread(id: string): Promise<ChatThread | null> {
  if (!id || !hasAdminCredentials()) return null;

  const snapshot = await adminDb().collection(COLLECTION).doc(id).get();
  if (!snapshot.exists) return null;
  return shapeThread(snapshot.id, snapshot.data()!);
}

/** Newest conversation first — operations works the top of this list. */
export async function readThreads(limit = 100): Promise<ChatThread[]> {
  if (!hasAdminCredentials()) return [];

  try {
    const snapshot = await adminDb()
      .collection(COLLECTION)
      .orderBy("lastAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => shapeThread(doc.id, doc.data()));
  } catch {
    // An inbox that shows nothing is better than a console that will not open.
    return [];
  }
}

export interface Appended {
  readonly thread: ChatThread;
  readonly created: boolean;
}

/**
 * Add a message, creating the thread if this is the first one.
 *
 * Read-then-write rather than `arrayUnion`, because the guards need to see what
 * is already there — how many messages the thread holds and when the visitor
 * last spoke. `arrayUnion` would append without ever looking, which is fine for
 * a set and useless for a rate limit.
 *
 * Not a transaction. Two messages racing into one thread would both be kept,
 * which is the correct outcome for a chat; the only thing at risk is the
 * message count being briefly under-counted, and the cap is a courtesy rather
 * than a security boundary.
 */
export async function appendMessage(
  threadId: string | undefined,
  author: ChatAuthor,
  body: string,
  now: Date,
  meta?: { name?: string; mobile?: string; accountId?: string },
): Promise<Appended> {
  if (!hasAdminCredentials()) {
    throw new ChatError(
      "Chat is not configured on this deployment.",
      "unconfigured",
    );
  }

  const db = adminDb();
  const message = { id: randomUUID(), author, body, at: now };

  const existing = threadId ? await readThread(threadId) : null;

  if (!existing) {
    // A visitor may not choose their own thread id: it is what identifies the
    // conversation, and one taken from a cookie a person can edit would let
    // them read somebody else's.
    const reference = db.collection(COLLECTION).doc();
    await reference.set({
      startedAt: now,
      lastAt: now,
      messages: [message],
      ...(meta?.name ? { name: meta.name } : {}),
      ...(meta?.mobile ? { mobile: meta.mobile } : {}),
      ...(meta?.accountId ? { accountId: meta.accountId } : {}),
    });

    const thread = await readThread(reference.id);
    return { thread: thread!, created: true };
  }

  if (author === "visitor") guardThread(existing, now);

  await db
    .collection(COLLECTION)
    .doc(existing.id)
    .update({
      lastAt: now,
      messages: [...existing.messages, message],
      // Operations answering marks the thread answered; a visitor writing again
      // reopens it, which is what puts it back in front of somebody.
      ...(author === "operations" ? { answeredAt: now } : { answeredAt: null }),
    });

  const thread = await readThread(existing.id);
  return { thread: thread!, created: false };
}
