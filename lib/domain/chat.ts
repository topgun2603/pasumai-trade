import { checkMobile, required } from "@/lib/domain/registration";
import type { PlatformPolicy } from "@/lib/domain/policy";
import { isLocale, type Locale } from "@/lib/i18n/config";

/**
 * The chat a visitor can open without an account.
 *
 * It replaces the enquiry form, and the difference that matters is the wait. A
 * form said "we will call you back" and then went quiet for as long as it took;
 * a chat answers immediately even when nobody is there, because the automatic
 * reply says *when* somebody will read it. The person deciding whether to
 * register learns something either way.
 *
 * ## Anonymous, and what that costs
 *
 * There is no account behind a visitor thread, so there is nothing to rate
 * limit *by* except the thread itself. Every guard here is therefore per
 * thread: a cap on how many messages one thread may hold, and a minimum gap
 * between them. Neither stops somebody determined to open threads in a loop —
 * that needs App Check or a limit at the edge, which is the same gap the signup
 * endpoint has and is worth closing in one place rather than two.
 */

export const MAX_MESSAGE_LENGTH = 1000;

/** Enough for a real conversation, few enough that one thread cannot be a flood. */
export const MAX_MESSAGES_PER_THREAD = 60;

/** A person types slower than this; a script does not. */
export const MIN_GAP_MS = 1500;

export type ChatAuthor = "visitor" | "operations" | "system";

export interface ChatMessage {
  readonly id: string;
  readonly author: ChatAuthor;
  /** English, always. What the operator sent or the visitor typed. */
  readonly body: string;
  /**
   * Set when the operator picked a standard reply rather than typing.
   *
   * The sentence is not stored per language — the id is, and the reader's
   * language decides which of the six they see. So a thread renders in
   * whatever language it is read in, and fixing a clumsy sentence fixes every
   * conversation it was ever sent in.
   */
  readonly replyId?: string;
  readonly at: Date;
}

export interface ChatThread {
  readonly id: string;
  /** Asked for before the first message, so operations can always call back. */
  readonly name: string;
  readonly mobile: string;
  /**
   * The language the site was in when they opened the chat.
   *
   * Kept on the thread rather than read per request, because operations may
   * answer hours later and the standard reply has to go out in the language the
   * person was actually reading.
   */
  readonly locale: Locale;
  /** Set when a signed-in person opens a thread, absent for a visitor. */
  readonly accountId?: string;
  readonly startedAt: Date;
  readonly lastAt: Date;
  /** Operations has read everything up to here. */
  readonly answeredAt?: Date;
  readonly messages: readonly ChatMessage[];
}

export class ChatError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

/**
 * Whether a person would be reading this right now.
 *
 * IST, because the hours are published in IST and the server is not
 * necessarily anywhere near it. Computed from the parts rather than by
 * constructing a shifted `Date`, which is the usual way this goes wrong twice a
 * year in places that observe daylight saving — India does not, but the code
 * should not depend on that being true of wherever it runs.
 */
export function istHour(at: Date): number {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours();
}

export function isOpen(policy: PlatformPolicy, at: Date): boolean {
  const hour = istHour(at);
  const { chatOpensHour: opens, chatClosesHour: closes } = policy;

  // A window that ends before it starts is a misconfiguration, not an
  // overnight shift. Treated as closed rather than as always open, because
  // silence is a smaller lie than a promise of a reply nobody will make.
  if (closes <= opens) return false;

  return hour >= opens && hour < closes;
}

/** `9` becomes `9 am`, `18` becomes `6 pm`. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

/**
 * What the platform says back the instant a visitor sends something.
 *
 * Always sent, open or closed. Inside hours it sets an expectation; outside, it
 * says when somebody will actually read it. The one thing it never does is
 * pretend to be a person — it is written as the platform speaking, because a
 * bot answering in the first person is how a chat loses the trust it was opened
 * to build.
 */
export function automaticReply(policy: PlatformPolicy, at: Date): string {
  if (isOpen(policy, at)) {
    return "Thanks — somebody from operations is reading this and will reply here shortly.";
  }

  const opens = hourLabel(policy.chatOpensHour);
  const closes = hourLabel(policy.chatClosesHour);

  return (
    `Thanks. Operations reads the chat between ${opens} and ${closes}, ` +
    `so this will be answered when they are next in. Your message is saved — ` +
    `leave this window and it will still be here.`
  );
}

/** The greeting shown before anybody has typed anything. */
export function openingMessage(policy: PlatformPolicy, at: Date): string {
  return isOpen(policy, at)
    ? "Ask us anything about selling, buying or getting an account. We are reading now."
    : `Ask us anything. Operations reads the chat between ${hourLabel(policy.chatOpensHour)} and ${hourLabel(policy.chatClosesHour)}, and will answer here.`;
}

/** Trimmed, capped, and refused if there is nothing left. */
export function cleanMessage(raw: unknown): string {
  const body = typeof raw === "string" ? raw.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!body) throw new ChatError("Type a message first.", "empty");
  return body;
}

/**
 * Whether this thread may accept another message.
 *
 * Both limits are about one thread rather than one person, because an anonymous
 * visitor is not a person the server can recognise twice.
 */
export function guardThread(thread: Pick<ChatThread, "messages" | "lastAt">, now: Date): void {
  if (thread.messages.length >= MAX_MESSAGES_PER_THREAD) {
    throw new ChatError(
      "This conversation is full. Register and operations can carry on with you there.",
      "threadFull",
    );
  }

  const fromVisitor = [...thread.messages].reverse().find((m) => m.author === "visitor");
  if (fromVisitor && now.getTime() - fromVisitor.at.getTime() < MIN_GAP_MS) {
    throw new ChatError("Give that a moment to send.", "tooFast");
  }
}

export interface VisitorDetails {
  readonly name: string;
  readonly mobile: string;
  readonly locale: Locale;
}

/**
 * Who is writing, before they write.
 *
 * Required rather than optional, and asked once. A chat that can be answered
 * only inside the window is a chat that goes cold the moment somebody closes
 * the tab — the number is what lets operations finish the conversation by
 * telephone, which for a farmer on a patchy connection is often the only way it
 * finishes at all.
 */
export function checkDetails(raw: {
  name?: unknown;
  mobile?: unknown;
  locale?: unknown;
}): { values: VisitorDetails; errors: Record<string, string> } {
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
  const mobile = typeof raw.mobile === "string" ? raw.mobile.trim().slice(0, 20) : "";
  const locale = typeof raw.locale === "string" && isLocale(raw.locale) ? raw.locale : "en";

  const errors: Record<string, string> = {};
  const nameProblem = required(name, "Name");
  if (nameProblem) errors.name = nameProblem;
  // The same check the registration forms use, so a number accepted here is a
  // number that will still be accepted when they come to open an account.
  const mobileProblem = checkMobile(mobile);
  if (mobileProblem) errors.mobile = mobileProblem;

  return { values: { name, mobile, locale }, errors };
}
