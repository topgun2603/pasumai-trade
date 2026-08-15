import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/auth/claims";
import { checkMobile, toE164 } from "./registration";
import {
  accountFor,
  canSelfSignup,
  COLLECTION_FOR_SIGNUP,
  newAccountId,
  SELF_SIGNUP_ROLES,
  validateSignup,
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
    password: "tomato river lantern",
    mobile: "9843011204",
    place: "Tiruppur",
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

  it("rejects a short password however complex", () => {
    expect(validateSignup(form({ password: "Aa1!Aa1!" })).password).toBeDefined();
  });

  it("accepts a long passphrase with no symbols", () => {
    expect(validateSignup(form({ password: "correct horse battery" })).password).toBeUndefined();
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
    expect(newAccountId("franchise", "abc123")).toMatch(/^B-/);
    expect(newAccountId("transport", "abc123")).toMatch(/^AG-/);
    expect(newAccountId("manpower", "abc123")).toMatch(/^AG-/);
    expect(newAccountId("farmer", "abc123")).toMatch(/^F-/);
  });

  it("is fixed width and upper case, whatever the input", () => {
    expect(newAccountId("buyer", "deadbeefcafe")).toBe("B-DEADBE");
  });

  it("writes each role to the collection its console reads", () => {
    expect(COLLECTION_FOR_SIGNUP.buyer).toBe("buyers");
    expect(COLLECTION_FOR_SIGNUP.franchise).toBe("buyers");
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
