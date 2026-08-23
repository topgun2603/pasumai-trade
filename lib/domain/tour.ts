import type { Role } from "@/lib/auth/claims";

/**
 * The first time somebody signs in, shown over the console itself.
 *
 * ## Why coach marks and not a welcome carousel
 *
 * The usual build is three swipeable slides before the app appears. They are
 * shown once, before the reader has any context for what they are being told,
 * and they are overwhelmingly skipped — which means the explaining still has to
 * happen somewhere, and now there are two places to keep true.
 *
 * These point at the real rail instead. "Bargains is where a buyer offers you a
 * price" lands when the word *Bargains* is on the screen with an arrow to it,
 * and the reader is already where the sentence is about. It also degrades
 * safely: a step whose target is not on this screen — a link this role does not
 * have, a rail collapsed on a phone — is skipped rather than shown pointing at
 * nothing.
 *
 * ## Why targets are hrefs
 *
 * Every rail on this platform renders its links from a list, so tagging them is
 * one attribute in one map rather than a hand-placed marker per item — and an
 * href already identifies a destination uniquely. A link that gets renamed or
 * reordered keeps its step; a link that is *removed* loses its step silently,
 * which is the correct failure.
 *
 * Deliberately no admin tour. Operations are trained, they sit with the console
 * all day, and they are the people who would be answering the questions a tour
 * asks.
 */

export interface TourStep {
  /** The `href` of the rail item this step points at. */
  readonly target: string;
  readonly title: string;
  /** Two sentences at most. This is read standing up, on a phone, once. */
  readonly body: string;
}

export interface Tour {
  /** Stored against the account, so a renamed tour shows again on purpose. */
  readonly id: string;
  readonly greeting: string;
  readonly opening: string;
  readonly steps: readonly TourStep[];
}

/*
  The farmer tour is the one that matters. A buyer or an agency owner arrives
  having signed a contract and been walked through it; a grower may be opening
  their first marketplace on a borrowed handset. Hence the plainest wording of
  the five, and the promise about price stated outright — it is the single thing
  that makes this different from a mandi, and nobody will infer it from a rail.
*/
const FARMER: Tour = {
  id: "farm",
  greeting: "Welcome to Pasumai Trade",
  opening:
    "Five quick things and you are done. You can stop any time and start it again from your Account page.",
  steps: [
    {
      target: "/farm",
      title: "Your day, in one place",
      body: "What you have for sale, who is waiting on a reply, and what you are owed. Start here each morning.",
    },
    {
      target: "/farm/listings",
      title: "Put up what you have",
      body: "Say the crop, how much of it, and the price you want. Buyers see it the moment you post it.",
    },
    {
      target: "/farm/bargains",
      title: "You settle the price",
      body: "A buyer offers, you accept or ask for more. Nobody sets your price for you, and no commission agent sits in between.",
    },
    {
      target: "/farm/notifications",
      title: "We will tell you here",
      body: "When a buyer replies, when a load is agreed, when a lorry is coming. Check the bell if you have been away.",
    },
    {
      // Points at Account, not at the verification page itself. Verification
      // moved underneath it, and a tour step has to highlight something on the
      // rail or it highlights nothing — which is what `tour.test.ts` caught.
      target: "/farm/account",
      title: "Send your papers once",
      body: "Your documents, bank details and plan are all here. Selling needs the documents checked first — done once, and it takes a day or two.",
    },
  ],
};

const BUYER_STEPS: readonly TourStep[] = [
  {
    target: "/listings",
    title: "What is available today",
    body: "Everything farmers have posted, newest first. Filter by crop or district to find what you are buying.",
  },
  {
    target: "/bargains",
    title: "Agree a price directly",
    body: "Offer on a listing and the farmer answers you. The thread is the record — what was agreed is what was said here.",
  },
  {
    target: "/orders",
    title: "What you have committed to",
    body: "Every agreed load, and where it has got to. Collection is arranged from here once a price is settled.",
  },
  {
    /*
      One step, not two. Documents and the plan both moved under Account, and
      two consecutive steps pointing a spotlight at the same rail item is a
      tour that looks broken.
    */
    target: "/account",
    title: "Papers and your plan",
    body: "GST, PAN and FSSAI go here once. Your subscription lives here too. Nothing can be bought until both are sorted.",
  },
];

const BUYER: Tour = {
  id: "buying",
  greeting: "Welcome to Pasumai Trade",
  opening:
    "A quick look at the five screens you will use. It takes under a minute.",
  steps: BUYER_STEPS,
};

/*
  A franchise buys exactly as a buyer does, and then does two things no buyer
  may: it dispatches vehicles and it holds grower records. Same opening steps,
  then those two — kept last because they are the part that is genuinely theirs,
  and the part worth remembering.
*/
const FRANCHISE: Tour = {
  id: "franchise",
  greeting: "Welcome to Pasumai Trade",
  opening:
    "You buy like any buyer, and you do two things no buyer does. Here is the tour.",
  steps: [
    ...BUYER_STEPS,
    {
      target: "/franchise/dispatch",
      title: "Getting it collected",
      body: "Agreed loads waiting for a vehicle. Offer one to an agency and they accept it from their own console.",
    },
    {
      target: "/franchise/farmers",
      title: "Your growers",
      body: "The farmers you have onboarded, and their documents. Bank details are collected in person, never over the phone.",
    },
  ],
};

const TRANSPORT: Tour = {
  id: "transport",
  greeting: "Welcome to Pasumai Trade",
  opening: "The screens that run your day. This takes under a minute.",
  steps: [
    {
      target: "/agency",
      title: "Where your day stands",
      body: "Loads running, vehicles free, and anything needing you. Start here.",
    },
    {
      target: "/agency/pickups",
      title: "Loads on offer",
      body: "Collection jobs offered to your agency. Accept one and it is yours, so this is the screen to keep open.",
    },
    {
      target: "/agency/fleet",
      title: "Your lorries",
      body: "Add each vehicle once, with its permit and fitness dates. We warn you before any of them lapse.",
    },
    {
      target: "/agency/drivers",
      title: "Who is driving",
      body: "Licences and when they expire. A load cannot go to a driver whose licence has run out.",
    },
    {
      target: "/agency/profile",
      title: "Your agency papers",
      body: "Checked once by operations. No load reaches you until they are through.",
    },
  ],
};

const MANPOWER: Tour = {
  id: "manpower",
  greeting: "Welcome to Pasumai Trade",
  opening: "The screens that run your day. This takes under a minute.",
  steps: [
    {
      target: "/agency",
      title: "Where your day stands",
      body: "Jobs running, crew free, and anything needing you. Start here.",
    },
    /*
      No step for the loads board. `/agency/pickups` is a transport link — a
      manpower agency does not have one, and the first draft of this tour
      pointed at it anyway. The step was silently dropped, exactly as designed,
      but a step that can only ever be dropped is a step that should not be
      written: crew is where this console actually begins.
    */
    {
      target: "/agency/workers",
      title: "Your crew",
      body: "Everyone you can send out, and what they are trained on. Keep it current — work is matched against it.",
    },
    {
      // One step. Details, papers and the plan all live under Profile now, and
      // two spotlights on the same rail item read as a broken tour.
      target: "/agency/profile",
      title: "Your agency",
      body: "Where you are based, what you cover, and your papers. All of it decides which work reaches you.",
    },
  ],
};

/** No tour for operations — see the note at the top of this file. */
export const TOURS: Partial<Record<Role, Tour>> = {
  farmer: FARMER,
  buyer: BUYER,
  franchise: FRANCHISE,
  transport: TRANSPORT,
  manpower: MANPOWER,
};

export function tourFor(role: Role): Tour | null {
  return TOURS[role] ?? null;
}
