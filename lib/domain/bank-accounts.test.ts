import { describe, expect, it } from "vitest";

import {
  addBankAccount,
  applyVerification,
  BankAccountError,
  canAttemptVerification,
  findDuplicate,
  makePrimary,
  markVerificationPending,
  MAX_BANK_ACCOUNTS,
  MAX_VERIFY_ATTEMPTS,
  payoutReady,
  primaryAccount,
  removeBankAccount,
  validateBankAccount,
  type BankAccount,
} from "./bank-accounts";

const NOW = new Date("2026-03-01T10:00:00Z");

const INPUT = {
  accountName: "R. Murugan",
  bankName: "Indian Bank",
  accountNumber: "412300998877",
  ifsc: "IDIB000E501",
};

/** One account, added and then carried to whatever state the test needs. */
function seeded(): BankAccount[] {
  return addBankAccount([], INPUT, "b_1", NOW);
}

function verified(): BankAccount[] {
  const pending = markVerificationPending(seeded(), "b_1", "fav_1", NOW);
  return applyVerification(
    pending,
    "b_1",
    {
      provider: "razorpayx",
      validationId: "fav_1",
      accountStatus: "active",
      registeredName: "MURUGAN R",
    },
    NOW,
  );
}

describe("validating what was typed", () => {
  it("accepts a well-formed account", () => {
    const errors = validateBankAccount(INPUT);
    expect(Object.values(errors).filter(Boolean)).toEqual([]);
  });

  it("refuses a malformed IFSC and a short account number", () => {
    const errors = validateBankAccount({
      ...INPUT,
      ifsc: "NOTANIFSC",
      accountNumber: "12345",
    });
    expect(errors.ifsc).toBeDefined();
    expect(errors.accountNumber).toBeDefined();
  });

  it("normalises spacing and case before comparing", () => {
    const list = seeded();
    const spaced = {
      ...INPUT,
      accountNumber: "4123 0099 8877",
      ifsc: "idib000e501",
    };
    expect(findDuplicate(list, spaced)).toBeDefined();
  });
});

describe("adding accounts", () => {
  /*
    The rule the whole module turns on. Making the first account primary for
    convenience would put the money in an unchecked account for everybody who
    only ever adds one — which is most people.
  */
  it("never makes a new account primary, even the first", () => {
    const list = seeded();
    expect(list[0].primary).toBe(false);
    expect(list[0].state).toBe("unverified");
    expect(primaryAccount(list)).toBeUndefined();
    expect(payoutReady(list)).toBe(false);
  });

  it("refuses the same account twice", () => {
    expect(() => addBankAccount(seeded(), INPUT, "b_2", NOW)).toThrow(
      BankAccountError,
    );
  });

  it("stops at the cap", () => {
    let list: BankAccount[] = [];
    for (let i = 0; i < MAX_BANK_ACCOUNTS; i++) {
      list = addBankAccount(
        list,
        { ...INPUT, accountNumber: `41230099887${i}` },
        `b_${i}`,
        NOW,
      );
    }
    expect(list).toHaveLength(MAX_BANK_ACCOUNTS);
    expect(() =>
      addBankAccount(list, { ...INPUT, accountNumber: "999999999" }, "b_x", NOW),
    ).toThrow(BankAccountError);
  });
});

describe("recording what the bank said", () => {
  it("verifies an active account whose name matches, and promotes it", () => {
    const list = verified();
    expect(list[0].state).toBe("verified");
    expect(list[0].verification?.nameMatch).toBe("exact");
    // Nothing else was primary, so the proved account becomes it.
    expect(list[0].primary).toBe(true);
    expect(payoutReady(list)).toBe(true);
  });

  /*
    An active account with a name that is merely consistent is a question, not
    a pass. Rounding `close` up to verified is how money reaches a relative
    with the same surname.
  */
  it("holds a close name for a person rather than clearing it", () => {
    const list = applyVerification(
      seeded(),
      "b_1",
      {
        provider: "razorpayx",
        accountStatus: "active",
        registeredName: "RAMASAMY MURUGAN",
      },
      NOW,
    );
    expect(list[0].verification?.nameMatch).toBe("close");
    expect(list[0].state).toBe("mismatch");
    expect(list[0].primary).toBe(false);
    expect(payoutReady(list)).toBe(false);
  });

  /*
    Razorpay answers `completed` with a null status and a null name for an
    account that does not exist. Absence is the verdict, not a missing field.
  */
  it("fails an account the bank could not resolve", () => {
    const list = applyVerification(
      seeded(),
      "b_1",
      { provider: "razorpayx", accountStatus: undefined, registeredName: undefined },
      NOW,
    );
    expect(list[0].state).toBe("failed");
  });

  it("fails an invalid account even if a name came back", () => {
    const list = applyVerification(
      seeded(),
      "b_1",
      {
        provider: "razorpayx",
        accountStatus: "invalid",
        registeredName: "MURUGAN R",
      },
      NOW,
    );
    expect(list[0].state).toBe("failed");
  });

  it("does not displace a primary that already works", () => {
    const first = verified();
    const two = addBankAccount(
      first,
      { ...INPUT, accountNumber: "500011112222" },
      "b_2",
      NOW,
    );
    const after = applyVerification(
      two,
      "b_2",
      {
        provider: "razorpayx",
        accountStatus: "active",
        registeredName: "MURUGAN R",
      },
      NOW,
    );
    expect(after.find((a) => a.id === "b_2")?.state).toBe("verified");
    expect(primaryAccount(after)?.id).toBe("b_1");
  });

  /*
    A retry showing the previous attempt's answer beside a spinner is confusing;
    a retry that never returns and leaves a stale `active` on the record is
    dangerous. Only the attempt count survives.
  */
  it("clears the last result when a retry starts", () => {
    const failed = applyVerification(
      seeded(),
      "b_1",
      { provider: "razorpayx", accountStatus: "invalid", registeredName: "SOMEBODY ELSE" },
      NOW,
    );
    const retrying = markVerificationPending(failed, "b_1", "fav_2", NOW);
    expect(retrying[0].state).toBe("pending");
    expect(retrying[0].verification?.registeredName).toBeUndefined();
    expect(retrying[0].verification?.accountStatus).toBeUndefined();
    expect(retrying[0].verification?.attempts).toBe(2);
  });
});

describe("spending the verification budget", () => {
  it("counts an attempt on the way out, not on the way back", () => {
    const started = markVerificationPending(seeded(), "b_1", "fav_1", NOW);
    expect(started[0].verification?.attempts).toBe(1);
  });

  it("stops after the cap", () => {
    let list = seeded();
    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      list = markVerificationPending(list, "b_1", `fav_${i}`, NOW);
      list = applyVerification(
        list,
        "b_1",
        { provider: "razorpayx", accountStatus: "invalid" },
        NOW,
      );
    }
    expect(canAttemptVerification(list[0])).toBe(false);
  });

  it("will not start a second check while one is in flight", () => {
    const started = markVerificationPending(seeded(), "b_1", "fav_1", NOW);
    expect(canAttemptVerification(started[0])).toBe(false);
  });

  it("will not re-check something already proved", () => {
    expect(canAttemptVerification(verified()[0])).toBe(false);
  });
});

describe("choosing where the money goes", () => {
  it("refuses to make an unverified account primary", () => {
    expect(() => makePrimary(seeded(), "b_1")).toThrow(BankAccountError);
  });

  it("refuses an account that is only a close name match", () => {
    const close = applyVerification(
      seeded(),
      "b_1",
      {
        provider: "razorpayx",
        accountStatus: "active",
        registeredName: "RAMASAMY MURUGAN",
      },
      NOW,
    );
    expect(() => makePrimary(close, "b_1")).toThrow(BankAccountError);
  });

  it("moves the flag rather than adding a second one", () => {
    const two = applyVerification(
      addBankAccount(verified(), { ...INPUT, accountNumber: "500011112222" }, "b_2", NOW),
      "b_2",
      { provider: "razorpayx", accountStatus: "active", registeredName: "MURUGAN R" },
      NOW,
    );
    const moved = makePrimary(two, "b_2");
    expect(moved.filter((a) => a.primary).map((a) => a.id)).toEqual(["b_2"]);
  });
});

describe("removing an account", () => {
  it("re-elects another verified account when the primary goes", () => {
    const two = applyVerification(
      addBankAccount(verified(), { ...INPUT, accountNumber: "500011112222" }, "b_2", NOW),
      "b_2",
      { provider: "razorpayx", accountStatus: "active", registeredName: "MURUGAN R" },
      NOW,
    );
    const after = removeBankAccount(two, "b_1");
    expect(after).toHaveLength(1);
    expect(primaryAccount(after)?.id).toBe("b_2");
  });

  /*
    An unverified account is not a payout destination, so it cannot inherit.
    Leaving nobody primary is the honest outcome — there is genuinely nowhere
    to pay, and the interface says so rather than pointing at an unchecked one.
  */
  it("does not promote an unverified account to fill the gap", () => {
    const two = addBankAccount(
      verified(),
      { ...INPUT, accountNumber: "500011112222" },
      "b_2",
      NOW,
    );
    const after = removeBankAccount(two, "b_1");
    expect(after).toHaveLength(1);
    expect(primaryAccount(after)).toBeUndefined();
    expect(payoutReady(after)).toBe(false);
  });

  it("leaves the primary alone when a different account goes", () => {
    const two = addBankAccount(
      verified(),
      { ...INPUT, accountNumber: "500011112222" },
      "b_2",
      NOW,
    );
    expect(primaryAccount(removeBankAccount(two, "b_2"))?.id).toBe("b_1");
  });

  it("refuses an id that is not there", () => {
    expect(() => removeBankAccount(seeded(), "nope")).toThrow(BankAccountError);
  });
});
