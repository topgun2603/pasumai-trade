import { describe, expect, it } from "vitest";

import { looksLikePlaceholder } from "./config";

/**
 * A production deploy shipped with every `NEXT_PUBLIC_FIREBASE_*` value set to
 * the literal string `[SENSITIVE]`, because a redacted environment dump was
 * pasted into the host's settings. The config check passed — the values were
 * present — and sign-in was dead for every account, with nothing to read but a
 * failed request to `identitytoolkit.googleapis.com?key=%5BSENSITIVE%5D`.
 *
 * The first case below is that exact string.
 */
describe("looksLikePlaceholder", () => {
  it("catches redaction markers, which is what actually shipped", () => {
    expect(looksLikePlaceholder("[SENSITIVE]")).toBe(true);
    expect(looksLikePlaceholder("[REDACTED]")).toBe(true);
    expect(looksLikePlaceholder("<your-api-key>")).toBe(true);
  });

  it("catches the fillers people leave in a copied example file", () => {
    for (const value of [
      "your-api-key",
      "YOUR_API_KEY",
      "changeme",
      "change-me",
      "xxxxx",
      "TODO",
      "placeholder",
      // Both of these arrive as strings when an env var is set from an
      // undefined value by a shell or a CI expression.
      "undefined",
      "null",
    ]) {
      expect(looksLikePlaceholder(value), `${value} should be rejected`).toBe(true);
    }
  });

  it("treats absent and blank as the same fault", () => {
    expect(looksLikePlaceholder(undefined)).toBe(true);
    expect(looksLikePlaceholder("")).toBe(true);
    expect(looksLikePlaceholder("   ")).toBe(true);
  });

  it("accepts real values, including ones that look odd", () => {
    for (const value of [
      // The shape of a real Firebase web key, and of the other seven fields.
      "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q",
      "pasumai-trade.firebaseapp.com",
      "pasumai-trade",
      "1:123456789012:web:abc123def456",
      "G-XXXXXXXXXX",
      // Deliberately awkward: refusing to start on a real key would be a worse
      // failure than the one this guard exists to catch.
      "xx",
      "null-island-prod",
      "your-company-prod-2026",
    ]) {
      expect(looksLikePlaceholder(value), `${value} should be accepted`).toBe(false);
    }
  });
});
