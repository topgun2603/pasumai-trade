import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/claims";
import { checkMobile, toE164 } from "./registration";
import {
  accountFor,
  checkPassword,
  canSelfSignup,
  COLLECTION_FOR_SIGNUP,
  newAccountId,
  SELF_SIGNUP_ROLES,
  validateSignup,
  checkPasswordConfirmation,
  validateCredentials,
  type SignupForm,
  type SignupRole,
} from "./signup";

const NOW = new Date("2026-08-15T09:00:00+05:30");

function form(over: Partial<SignupForm> = {}): SignupForm {
  return {
    role: "buyer",
    name: "Kongu Fresh",
    contactName: "R. Selvam",
    email: "selvam@kongufresh.in",
    password: "Tomato river 9!",
    confirmPassword: "Tomato river 9!",
    mobile: "9843011204",
    place: "Tiruppur",
    state: "tamil-nadu",
    district: "Tiruppur",
    pincode: "641601",
    ...over,
  };
}

describe("who may sign themselves up", () => {
  it("refuses operations", () => {
    expect(canSelfSignup("admin")).toBe(false);
    expect(validateSignup(form({ role: "admin" })).role).toBeDefined();
  });

  it("allows every other role", () => {
    for (const role of ROLES) {
      if (role === "admin") continue;
      expect(canSelfSignup(role)).toBe(true);
    }
  });

  it("covers every non-admin role, so a role added later is a failing test", () => {
    const expected = ROLES.filter((r) => r !== "admin");
    expect([...SELF_SIGNUP_ROLES].sort()).toEqual([...expected].sort());
  });

  it("refuses a role that is not a role at all", () => {
    expect(canSelfSignup("superuser")).toBe(false);
    expect(canSelfSignup("")).toBe(false);
  });
});

describe("validation", () => {
  it("accepts a filled form", () => {
    expect(Object.values(validateSignup(form())).filter(Boolean)).toEqual([]);
  });

  /*
    The policy changed from "twelve characters, no composition rules" to "eight
    with a capital, a number and a symbol". These pin the new one, including the
    case the old policy was written to allow and this one refuses.
  */
  it("wants eight characters, a capital, a number and a symbol", () => {
    expect(checkPassword("Aa1!Aa1!")).toBeUndefined();
    expect(checkPassword("Aa1!Aa1")).toBeDefined();
    expect(checkPassword("aa1!aa1!")).toBeDefined();
    expect(checkPassword("Aaaa!aaa")).toBeDefined();
    expect(checkPassword("Aa11aa11")).toBeDefined();
  });

  it("names everything missing at once, not one refusal at a time", () => {
    // Being told about one requirement per attempt is how people arrive at
    // `Password1!`, so all of it is said in one go.
    const said = checkPassword("short")!;
    expect(said).toContain("8 characters");
    expect(said).toContain("capital");
    expect(said).toContain("number");
    expect(said).toContain("symbol");
  });

  it("refuses the long passphrase the old policy was built around", () => {
    // Kept as a test rather than deleted: this is the case the change gives up,
    // and it should be visible that it was given up on purpose.
    expect(checkPassword("correct horse battery")).toBeDefined();
  });

  it("rejects a landline and a mobile with the wrong leading digit", () => {
    expect(validateSignup(form({ mobile: "0422 2201234" })).mobile).toBeDefined();
    expect(validateSignup(form({ mobile: "5843011204" })).mobile).toBeDefined();
  });

  it("rejects a blank name even when it is all spaces", () => {
    expect(validateSignup(form({ name: "   " })).name).toBeDefined();
  });
});

describe("the account a signup creates", () => {
  const roles: SignupRole[] = [...SELF_SIGNUP_ROLES];

  it("is always pending, for every role", () => {
    for (const role of roles) {
      const account = accountFor(role, "X-1", form({ role }), NOW);
      expect(account.status).toBe("pending");
    }
  });

  it("carries no documents and no history", () => {
    for (const role of roles) {
      const account = accountFor(role, "X-1", form({ role }), NOW);
      expect(account.documents).toEqual([]);
    }
    const buyer = accountFor("buyer", "B-1", form({ role: "buyer" }), NOW);
    expect(buyer.ordersPlaced).toBe(0);
    const farmer = accountFor("farmer", "F-1", form({ role: "farmer" }), NOW);
    expect(farmer.completedOrders).toBe(0);
    expect(farmer.activeListings).toBe(0);
  });

  it("gives an agency only the service it signed up for", () => {
    expect(accountFor("transport", "AG-1", form({ role: "transport" }), NOW).services).toEqual([
      "transport",
    ]);
    expect(accountFor("manpower", "AG-2", form({ role: "manpower" }), NOW).services).toEqual([
      "manpower",
    ]);
  });

  it("distinguishes a franchise from an independent buyer", () => {
    expect(accountFor("franchise", "B-1", form({ role: "franchise" }), NOW).kind).toBe("franchise");
    expect(accountFor("buyer", "B-2", form({ role: "buyer" }), NOW).kind).toBe("independent");
  });

  it("puts a farmer's place in village and a buyer's in town", () => {
    expect(accountFor("farmer", "F-1", form({ role: "farmer", place: "Hosur" }), NOW).village).toBe(
      "Hosur",
    );
    expect(accountFor("buyer", "B-1", form({ role: "buyer", place: "Erode" }), NOW).town).toBe(
      "Erode",
    );
  });

  it("marks a self-registered farmer as such", () => {
    expect(accountFor("farmer", "F-1", form({ role: "farmer" }), NOW).registeredBy).toBe("self");
  });
});

describe("account ids", () => {
  it("uses the prefix the seeded records already use", () => {
    expect(newAccountId("buyer", "abc123")).toMatch(/^B-/);
    // A franchise is not a buyer with a flag on it any more, and its id says
    // so — B- and FR- cannot be confused in a support call.
    expect(newAccountId("franchise", "abc123")).toMatch(/^FR-/);
    expect(newAccountId("transport", "abc123")).toMatch(/^AG-/);
    expect(newAccountId("manpower", "abc123")).toMatch(/^AG-/);
    expect(newAccountId("farmer", "abc123")).toMatch(/^F-/);
  });

  it("is fixed width and upper case, whatever the input", () => {
    expect(newAccountId("buyer", "deadbeefcafe")).toBe("B-DEADBE");
  });

  it("writes each role to the collection its console reads", () => {
    expect(COLLECTION_FOR_SIGNUP.buyer).toBe("buyers");
    // Its own collection: a franchise onboards farmers and dispatches
    // vehicles, and a buyer does neither. Sharing one meant every read of
    // "our buyers" silently included franchises.
    expect(COLLECTION_FOR_SIGNUP.franchise).toBe("franchises");
    expect(COLLECTION_FOR_SIGNUP.transport).toBe("agencies");
    expect(COLLECTION_FOR_SIGNUP.manpower).toBe("agencies");
    expect(COLLECTION_FOR_SIGNUP.farmer).toBe("farmers");
  });
});

describe("email", () => {
  // Regression: the shared checker's character classes had lost their
  // backslashes, so `[^s@]` meant "not the letter s" and every address with an
  // s in the local part was refused — including the platform's own.
  it("accepts addresses containing s", () => {
    for (const email of [
      "selvam@kongufresh.in",
      "purchasing@kongu.in",
      "ops@srirealtime.com",
      "sales@example.co.in",
    ]) {
      expect(validateSignup(form({ email })).email).toBeUndefined();
    }
  });

  it("still catches a missing @ and a bare domain", () => {
    expect(validateSignup(form({ email: "selvam.kongufresh.in" })).email).toBeDefined();
    expect(validateSignup(form({ email: "selvam@kongufresh" })).email).toBeDefined();
  });
});

describe("mobile numbers for Firebase", () => {
  it("adds the country code to a plain ten-digit number", () => {
    expect(toE164("9843011204")).toBe("+919843011204");
  });

  it("survives the ways people actually write them", () => {
    for (const written of [
      "98430 11204",
      "+91 98430 11204",
      "919843011204",
      "+919843011204",
      "098430 11204",
      "98430-11204",
    ]) {
      expect(toE164(written)).toBe("+919843011204");
    }
  });

  it("refuses anything that is not an Indian mobile", () => {
    // Landline, too short, too long, and a leading digit India does not issue.
    expect(toE164("0422 2201234")).toBeNull();
    expect(toE164("98430")).toBeNull();
    expect(toE164("98430112040")).toBeNull();
    expect(toE164("5843011204")).toBeNull();
    expect(toE164("")).toBeNull();
  });

  // A number that survived checkMobile must survive this too, or a signup
  // passes validation and then fails at Firebase with a worse message.
  it("accepts everything checkMobile accepts", () => {
    for (const n of ["6000000000", "7538891944", "9047821134", "8123456789"]) {
      expect(checkMobile(n)).toBeUndefined();
      expect(toE164(n)).toBe(`+91${n}`);
    }
  });
});

describe("confirming a password", () => {
  /*
    Bug 3. The field was missing entirely, so a typo in a masked box created
    an account whose password was not the one the person thought they chose —
    and the first they knew of it was being locked out of it.
  */
  it("accepts two that match", () => {
    expect(checkPasswordConfirmation("Str0ng!pass", "Str0ng!pass")).toBeUndefined();
  });

  it("refuses two that differ", () => {
    expect(checkPasswordConfirmation("Str0ng!pass", "Str0ng!pasa")).toBe(
      "Both passwords must match",
    );
  });

  it("notices a trailing space rather than trimming it away", () => {
    // Trimming would accept a password the browser will not send back.
    expect(checkPasswordConfirmation("Str0ng!pass", "Str0ng!pass ")).toBe(
      "Both passwords must match",
    );
  });

  it("asks for the second one when it is empty", () => {
    expect(checkPasswordConfirmation("Str0ng!pass", "")).toBe("Type the password again");
  });

  it("says nothing at all while the password is empty", () => {
    // The password field is already refusing. Two messages for one untouched
    // form reads as a broken page rather than as guidance.
    expect(checkPasswordConfirmation("", "")).toBeUndefined();
    expect(checkPasswordConfirmation("", "anything")).toBeUndefined();
  });

  it("is not part of the credentials that reach the server", () => {
    // A confirmation the server receives is a second copy of a password
    // travelling for no reason: there is nothing there to compare it against.
    const credentials = validateCredentials({
      email: "a@b.in",
      password: "Str0ng!pass",
    });
    expect(Object.keys(credentials)).toEqual(["email", "password"]);
  });
});
