import { describe, expect, it } from "vitest";

import {
  readRenewalToken,
  renewalDestination,
  renewalToken,
  RENEWAL_LINK_TTL_MS,
} from "./renewal-link";

const SECRET = "a-test-secret-that-is-long-enough";
const NOW = Date.UTC(2026, 7, 23, 9, 0, 0);
const CLAIM = {
  accountId: "F-3E4ADB",
  collection: "farmers",
  expiresAt: NOW + RENEWAL_LINK_TTL_MS,
};

describe("the renewal link", () => {
  it("reads back what it signed", () => {
    const result = readRenewalToken(renewalToken(CLAIM, SECRET), SECRET, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claim).toEqual(CLAIM);
  });

  it("refuses a token signed with a different secret", () => {
    const token = renewalToken(CLAIM, "somebody-elses-secret");
    const result = readRenewalToken(token, SECRET, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("badSignature");
  });

  it("refuses a tampered account id", () => {
    /*
      The whole point. Without a signature this is a query parameter, and
      editing it walks the account space — find out who exists, and land on a
      page naming them.
    */
    const token = renewalToken(CLAIM, SECRET);
    const [, signature] = token.split(".");
    const forged = `${Buffer.from("B-99999:buyers:" + CLAIM.expiresAt).toString("base64url")}.${signature}`;

    const result = readRenewalToken(forged, SECRET, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("badSignature");
  });

  it("expires", () => {
    const token = renewalToken(CLAIM, SECRET);
    expect(readRenewalToken(token, SECRET, CLAIM.expiresAt - 1).ok).toBe(true);
    const dead = readRenewalToken(token, SECRET, CLAIM.expiresAt);
    expect(dead.ok).toBe(false);
    if (!dead.ok) expect(dead.reason).toBe("expired");
  });

  it("calls a forged expired token forged, not expired", () => {
    // Signature is checked first on purpose: something that was never ours
    // should not be reported as merely late, which reads as "try again".
    const token = renewalToken({ ...CLAIM, expiresAt: NOW - 1 }, "wrong-secret");
    const result = readRenewalToken(token, SECRET, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("badSignature");
  });

  it("refuses rubbish without throwing", () => {
    for (const rubbish of ["", ".", "a.b", "no-dot", "!!!.???", "a".repeat(500)]) {
      const result = readRenewalToken(rubbish, SECRET, NOW);
      expect(result.ok, rubbish).toBe(false);
    }
  });

  it("sends each role to its own console", () => {
    expect(renewalDestination("farmers")).toBe("/farm/account/subscription");
    expect(renewalDestination("buyers")).toBe("/account/subscription");
    expect(renewalDestination("agencies")).toBe("/account/subscription");
  });

  it("carries no session, only an account id", () => {
    /*
      Pinned as a decision, not an implementation detail. An SMS is forwarded,
      screenshotted and read off lock screens; a link that authenticates turns
      every one of those into somebody else's account.
    */
    const token = renewalToken(CLAIM, SECRET);
    const decoded = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    expect(decoded).toBe(`F-3E4ADB:farmers:${CLAIM.expiresAt}`);
    expect(decoded).not.toMatch(/token|session|uid|auth/i);
  });
});
