import { describe, expect, it } from "vitest";

import { NOTIFICATION_KINDS } from "./notification";
import { isDeadToken, isPushable, tokenId } from "./push";

describe("what earns an interruption", () => {
  it("pushes the things that change somebody's morning", () => {
    expect(isPushable("bargainOpened")).toBe(true);
    expect(isPushable("bargainAgreed")).toBe(true);
    expect(isPushable("orderPlaced")).toBe(true);
    expect(isPushable("transportArranged")).toBe(true);
  });

  it("does not push chatter", () => {
    // A buzz per message is how somebody learns to mute the channel, and then
    // misses the one that mattered.
    expect(isPushable("bargainMessage")).toBe(false);
    expect(isPushable("bargainCountered")).toBe(false);
  });

  it("does not push every lot posted in a district", () => {
    // A buyer covering three districts would be interrupted several times a
    // morning by produce they have not asked about.
    expect(isPushable("produceListed")).toBe(false);
  });

  it("has an answer for every kind", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(typeof isPushable(kind), kind).toBe("boolean");
    }
  });

  it("pushes fewer kinds than it stores", () => {
    // The bell is where you look; a push is what finds you. If these two sets
    // were equal, one of them would be wrong.
    const pushed = NOTIFICATION_KINDS.filter(isPushable);
    expect(pushed.length).toBeLessThan(NOTIFICATION_KINDS.length);
    expect(pushed.length).toBeGreaterThan(0);
  });
});

describe("dead tokens", () => {
  it("recognises the codes that mean the device is gone", () => {
    expect(isDeadToken("messaging/registration-token-not-registered")).toBe(true);
    expect(isDeadToken("messaging/invalid-registration-token")).toBe(true);
  });

  it("does not treat a transport failure as a dead device", () => {
    // Deleting a live token because the network wobbled would silently stop a
    // farmer's phone buzzing, with nothing to show why.
    expect(isDeadToken("messaging/server-unavailable")).toBe(false);
    expect(isDeadToken("messaging/internal-error")).toBe(false);
    expect(isDeadToken(undefined)).toBe(false);
  });
});

describe("tokenId", () => {
  it("removes the slashes a document id may not contain", () => {
    const id = tokenId("abc/def+ghi:jkl");
    expect(id).not.toContain("/");
    expect(id).toBe("abc_def-ghi:jkl");
  });

  it("stays inside Firestore's id limit", () => {
    expect(tokenId("x".repeat(400)).length).toBeLessThanOrEqual(200);
  });

  it("keeps different tokens distinct", () => {
    expect(tokenId("aaa/bbb")).not.toBe(tokenId("aaa/ccc"));
  });
});
