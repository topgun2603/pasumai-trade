import { describe, expect, it } from "vitest";

import { bankIsUsable, bankState, checkAccountNumber } from "./bank";

const GOOD = {
  accountName: "R. Selvam",
  bankName: "Indian Bank",
  accountNumber: "412300998877",
  ifsc: "IDIB000E501",
};

describe("when a bank section is done", () => {
  /*
    Bug 18. The section was marked verified on presence alone, and a payout
    goes to whatever digits are on file — a wrong digit does not bounce, it
    pays somebody else. A tick beside an unchecked account is the platform
    saying it has checked something it has not.
  */
  it("is complete only when everything is there and holds up", () => {
    expect(bankState(GOOD)).toBe("complete");
    expect(bankIsUsable(GOOD)).toBe(true);
  });

  it("is empty when nothing has been given", () => {
    expect(bankState({})).toBe("empty");
    expect(bankIsUsable({})).toBe(false);
  });

  it("is partial when the bank name is missing", () => {
    expect(bankState({ ...GOOD, bankName: undefined })).toBe("partial");
    expect(bankState({ ...GOOD, bankName: "   " })).toBe("partial");
  });

  it("refuses a malformed IFSC even with every field filled", () => {
    // The case the old presence check passed and this exists to catch.
    const wrong = { ...GOOD, ifsc: "NOTANIFSC" };
    expect(bankState(wrong)).toBe("invalid");
    expect(bankIsUsable(wrong)).toBe(false);
  });

  it("refuses an account number that is not 9 to 18 digits", () => {
    expect(bankState({ ...GOOD, accountNumber: "12345" })).toBe("invalid");
    expect(bankState({ ...GOOD, accountNumber: "41230099887a" })).toBe("invalid");
  });

  it("never reports complete for anything half-given", () => {
    for (const field of ["accountName", "bankName", "accountNumber", "ifsc"] as const) {
      expect(bankIsUsable({ ...GOOD, [field]: undefined }), field).toBe(false);
    }
  });
});

describe("an account number", () => {
  it("takes 9 to 18 digits", () => {
    expect(checkAccountNumber("123456789")).toBeUndefined();
    expect(checkAccountNumber("123456789012345678")).toBeUndefined();
  });

  it("refuses anything shorter, longer, or not a digit", () => {
    expect(checkAccountNumber("12345678")).toBeDefined();
    expect(checkAccountNumber("1234567890123456789")).toBeDefined();
    expect(checkAccountNumber("4123 0099 8877")).toBeDefined();
    expect(checkAccountNumber("")).toBe("Account number is required");
  });
});
