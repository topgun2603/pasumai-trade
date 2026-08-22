import { describe, expect, it } from "vitest";

import {
  automaticReply,
  cleanMessage,
  ChatError,
  guardThread,
  hourLabel,
  isOpen,
  istHour,
  MAX_MESSAGES_PER_THREAD,
  MIN_GAP_MS,
  openingMessage,
} from "./chat";
import { DEFAULT_POLICY } from "./policy";

const policy = { ...DEFAULT_POLICY, chatOpensHour: 9, chatClosesHour: 18 };

/** A UTC instant, so the IST conversion is the thing under test. */
const utc = (iso: string) => new Date(iso);

describe("when the chat is answered", () => {
  it("reads the clock in IST, not wherever the server is", () => {
    // 05:00 UTC is 10:30 IST — inside hours, though a naive UTC reading of 5
    // would call it closed.
    expect(istHour(utc("2026-08-22T05:00:00Z"))).toBe(10);
    expect(isOpen(policy, utc("2026-08-22T05:00:00Z"))).toBe(true);

    // 15:00 UTC is 20:30 IST — outside, though UTC 15 is inside 9–18.
    expect(istHour(utc("2026-08-22T15:00:00Z"))).toBe(20);
    expect(isOpen(policy, utc("2026-08-22T15:00:00Z"))).toBe(false);
  });

  it("opens on the hour and closes on it", () => {
    // 03:30 UTC = 09:00 IST exactly.
    expect(isOpen(policy, utc("2026-08-22T03:30:00Z"))).toBe(true);
    // 12:30 UTC = 18:00 IST exactly — closing time is closed.
    expect(isOpen(policy, utc("2026-08-22T12:30:00Z"))).toBe(false);
  });

  it("treats a window that ends before it starts as closed", () => {
    /*
      Somebody typing 18 and 9 into Controls meant an evening shift and has
      written nonsense. Closed is the safe reading: the automatic reply says
      when we are in, where always-open would promise a person who is not there.
    */
    const backwards = { ...policy, chatOpensHour: 18, chatClosesHour: 9 };
    for (const hour of ["00:00", "06:00", "12:00", "18:00", "23:00"]) {
      expect(isOpen(backwards, utc(`2026-08-22T${hour}:00Z`))).toBe(false);
    }
  });
});

describe("what it says back", () => {
  it("promises a person only when one is there", () => {
    const open = automaticReply(policy, utc("2026-08-22T05:00:00Z"));
    expect(open).toMatch(/shortly/);

    const shut = automaticReply(policy, utc("2026-08-22T20:00:00Z"));
    // The closed reply must name the hours; that is the whole reason it exists.
    expect(shut).toContain("9 am");
    expect(shut).toContain("6 pm");
    expect(shut).not.toMatch(/shortly/);
  });

  it("says the hours in words a person reads, not 24-hour numbers", () => {
    expect(hourLabel(9)).toBe("9 am");
    expect(hourLabel(18)).toBe("6 pm");
    expect(hourLabel(0)).toBe("midnight");
    expect(hourLabel(12)).toBe("noon");
    expect(hourLabel(24)).toBe("midnight");
  });

  it("greets differently depending on whether anybody is reading", () => {
    expect(openingMessage(policy, utc("2026-08-22T05:00:00Z"))).toMatch(/reading now/);
    expect(openingMessage(policy, utc("2026-08-22T20:00:00Z"))).toContain("9 am");
  });
});

describe("what it will accept", () => {
  it("refuses a message that is only whitespace", () => {
    expect(() => cleanMessage("   \n ")).toThrow(ChatError);
    expect(() => cleanMessage(undefined)).toThrow(ChatError);
    expect(() => cleanMessage(42)).toThrow(ChatError);
  });

  it("trims and caps rather than refusing something long", () => {
    expect(cleanMessage("  hello  ")).toBe("hello");
    expect(cleanMessage("x".repeat(5000))).toHaveLength(1000);
  });

  const message = (author: "visitor" | "operations", agoMs: number, now: Date) => ({
    id: `m${agoMs}`,
    author,
    body: "hello",
    at: new Date(now.getTime() - agoMs),
  });

  it("lets a normal reply through", () => {
    const now = utc("2026-08-22T05:00:00Z");
    expect(() =>
      guardThread({ messages: [message("visitor", 60_000, now)], lastAt: now }, now),
    ).not.toThrow();
  });

  it("refuses a second message sent faster than a person types", () => {
    const now = utc("2026-08-22T05:00:00Z");
    expect(() =>
      guardThread({ messages: [message("visitor", MIN_GAP_MS - 1, now)], lastAt: now }, now),
    ).toThrow(/moment/);
  });

  it("measures the gap from the visitor, not from an operator's reply", () => {
    /*
      Operations answering a second ago must not lock the visitor out of
      replying — the limit exists to slow a script down, and a reply arriving
      right after an answer is exactly what a real conversation looks like.
    */
    const now = utc("2026-08-22T05:00:00Z");
    expect(() =>
      guardThread(
        {
          messages: [message("visitor", 60_000, now), message("operations", 10, now)],
          lastAt: now,
        },
        now,
      ),
    ).not.toThrow();
  });

  it("closes a thread that has gone on long enough to be a flood", () => {
    const now = utc("2026-08-22T05:00:00Z");
    const many = Array.from({ length: MAX_MESSAGES_PER_THREAD }, (_, i) =>
      message("visitor", 60_000 + i, now),
    );
    expect(() => guardThread({ messages: many, lastAt: now }, now)).toThrow(/full/);
  });
});
