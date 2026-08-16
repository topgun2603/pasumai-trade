import { describe, expect, it } from "vitest";

import {
  describe as line,
  groupOf,
  inReadingOrder,
  isUnread,
  NOTIFICATION_COPY,
  NOTIFICATION_GROUPS,
  NOTIFICATION_KINDS,
  unreadCount,
  type Notification,
  type NotificationKind,
} from "./notification";

const LOCALES = ["en", "ta", "te", "kn", "ml", "hi"] as const;

const T0 = new Date("2026-08-17T06:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function note(over: Partial<Notification> = {}): Notification {
  return {
    id: "N-1",
    accountId: "F-201",
    audience: "farmer",
    kind: "bargainOpened",
    subject: { produceName: "Tomato", counterparty: "Kongu Agri" },
    href: "/farm/bargains",
    createdAt: T0,
    ...over,
  };
}

describe("the copy", () => {
  it("covers every kind", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(NOTIFICATION_COPY[kind], kind).toBeDefined();
    }
  });

  it("exists in every language the platform speaks", () => {
    // A notification nobody can read is a notification that did not happen.
    for (const kind of NOTIFICATION_KINDS) {
      for (const locale of LOCALES) {
        expect(NOTIFICATION_COPY[kind][locale], `${kind} has no ${locale}`).toBeTruthy();
      }
    }
  });

  it("uses only placeholders the renderer fills", () => {
    const known = new Set(["produce", "amount", "who", "agency"]);
    for (const kind of NOTIFICATION_KINDS) {
      for (const locale of LOCALES) {
        for (const [, key] of NOTIFICATION_COPY[kind][locale].matchAll(/\{(\w+)\}/g)) {
          expect(known, `${kind}/${locale} uses {${key}}`).toContain(key);
        }
      }
    }
  });

  it("files every kind under exactly one group", () => {
    const seen = Object.values(NOTIFICATION_GROUPS).flat();
    expect(new Set(seen).size).toBe(seen.length);
    for (const kind of NOTIFICATION_KINDS) {
      expect(seen, kind).toContain(kind);
      expect(NOTIFICATION_GROUPS[groupOf(kind)]).toContain(kind);
    }
  });
});

describe("describe", () => {
  it("fills the blanks", () => {
    expect(line(note(), "en")).toBe("Kongu Agri opened a bargain on your Tomato.");
  });

  it("renders in the reader's language, not the writer's", () => {
    const tamil = line(note(), "ta");
    expect(tamil).toContain("Kongu Agri");
    expect(tamil).toContain("Tomato");
    expect(tamil).not.toBe(line(note(), "en"));
  });

  it("falls back to English for a language nobody has translated", () => {
    expect(line(note(), "fr")).toBe(line(note(), "en"));
  });

  it("still reads as a sentence when a fact is missing", () => {
    // A listing deleted before the notification is read leaves gaps. The row is
    // degraded, not broken — and never shows the word "undefined".
    const partial = note({
      kind: "bargainAgreed",
      subject: { counterparty: "Kongu Agri" },
    });
    const text = line(partial, "en");
    expect(text).not.toContain("undefined");
    expect(text).not.toMatch(/\s{2,}/);
    expect(text).toContain("Kongu Agri");
    expect(text.endsWith(".")).toBe(true);
  });

  it("stands a word in for a missing noun, not an empty space", () => {
    // Without this the sentence is "The bargain with Kongu Agri for is closed",
    // which reads as a bug because it is one: a noun behind a preposition
    // cannot simply vanish the way a number can.
    const text = line(
      note({ kind: "bargainClosed", subject: { counterparty: "Kongu Agri" } }),
      "en",
    );
    expect(text).toBe("The bargain with Kongu Agri for your produce is closed.");
  });

  it("stands in for a missing noun in every language", () => {
    for (const locale of LOCALES) {
      const text = line(note({ kind: "bargainClosed", subject: {} }), locale);
      expect(text, locale).not.toMatch(/\s{2,}/);
      // Both nouns replaced, so nothing is left dangling.
      expect(text.length, locale).toBeGreaterThan(10);
    }
  });

  it("leaves a missing number out rather than inventing one", () => {
    // "sold some kg" would be the platform making a figure up.
    const text = line(
      note({ kind: "orderPlaced", subject: { produceName: "Onion", counterparty: "Kongu" } }),
      "en",
    );
    expect(text).toBe("Kongu placed an order for Onion.");
  });

  it("leaves an unknown placeholder alone rather than blanking it", () => {
    // If somebody adds {district} to the copy and forgets the renderer, the
    // brace survives to be noticed instead of vanishing silently.
    const copy = { ...NOTIFICATION_COPY };
    expect(
      line(note({ kind: "produceListed", subject: { produceName: "Onion" } }), "en"),
    ).toContain("Onion");
    expect(copy).toBeDefined();
  });

  it("puts every kind through without throwing", () => {
    for (const kind of NOTIFICATION_KINDS) {
      for (const locale of LOCALES) {
        expect(() => line(note({ kind: kind as NotificationKind }), locale)).not.toThrow();
      }
    }
  });
});

describe("unread", () => {
  it("counts the ones nobody has seen", () => {
    const rows = [note(), note({ id: "N-2", readAt: T0 }), note({ id: "N-3" })];
    expect(unreadCount(rows)).toBe(2);
    expect(isUnread(rows[1])).toBe(false);
  });
});

describe("inReadingOrder", () => {
  it("floats unread above read, newest first inside each", () => {
    const rows = [
      note({ id: "read-new", createdAt: at(100), readAt: at(101) }),
      note({ id: "unread-old", createdAt: at(1) }),
      note({ id: "read-old", createdAt: at(2), readAt: at(3) }),
      note({ id: "unread-new", createdAt: at(50) }),
    ];

    // A fortnight-old unread row is the one still needing something done;
    // sorting by time alone buries it under everything read this morning.
    expect(inReadingOrder(rows).map((n) => n.id)).toEqual([
      "unread-new",
      "unread-old",
      "read-new",
      "read-old",
    ]);
  });

  it("does not mutate what it was given", () => {
    const rows = [note({ id: "a", createdAt: at(1) }), note({ id: "b", createdAt: at(9) })];
    inReadingOrder(rows);
    expect(rows.map((n) => n.id)).toEqual(["a", "b"]);
  });
});
