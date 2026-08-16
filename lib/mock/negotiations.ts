import type { GradeBand } from "@/lib/domain/models";
import type { Negotiation, NegotiationMessage } from "@/lib/domain/negotiation";

/**
 * Bargains in progress, at the stages that actually matter to the screen:
 * a fresh ask nobody has answered, a live back-and-forth, one about to expire,
 * one settled, and one the buyer walked away from.
 *
 * Farmer messages are in Tamil because that is what a farmer types. The buyer
 * side is in English. Neither is translated in the data — the thread renders
 * each message in the script it was written in, which is the honest thing to
 * show and the reason `locale` is on the message.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function bands(a: number, b: number, c: number): GradeBand[] {
  return [
    { grade: "a", ratePerUnit: a },
    { grade: "b", ratePerUnit: b },
    { grade: "c", ratePerUnit: c },
  ];
}

interface Line {
  author: "farmer" | "buyer";
  kind: NegotiationMessage["kind"];
  text?: string;
  locale?: string;
  bands?: GradeBand[];
  /** Minutes before now. */
  ago: number;
  validForMinutes?: number;
}

function thread(
  base: Omit<Negotiation, "messages" | "openedAt">,
  lines: Line[],
  now: number,
): Negotiation {
  const messages = lines.map((line, index): NegotiationMessage => {
    const sentAt = new Date(now - line.ago * MINUTE);
    return {
      id: `${base.id}-M${index + 1}`,
      author: line.author,
      kind: line.kind,
      text: line.text,
      locale: line.locale,
      bands: line.bands,
      expiresAt: line.validForMinutes
        ? new Date(sentAt.getTime() + line.validForMinutes * MINUTE)
        : undefined,
      sentAt,
    };
  });

  return {
    ...base,
    messages,
    openedAt: messages[0]?.sentAt ?? new Date(now),
  };
}

export function negotiations(now: number = Date.now()): Negotiation[] {
  return [
    // Farmer has asked; nobody has answered. The buyer's queue starts here.
    thread(
      {
        id: "N-4101",
        listingId: "L-4821",
        produceName: "Tomato",
        farmerId: "F-201",
        buyerId: "B-1001",
        farmerName: "R. Murugan",
        buyerName: "Kongu Agri Traders",
        quantity: 800,
        unit: "kg",
        status: "open",
      },
      [
        {
          author: "farmer",
          kind: "proposal",
          text: "இன்று காலை பறித்தது. நல்ல தரம்.",
          locale: "ta",
          bands: bands(2600, 2100, 1450),
          ago: 42,
        },
      ],
      now,
    ),

    // Live bargain, three rounds in, buyer's number on the table.
    thread(
      {
        id: "N-4102",
        listingId: "L-4819",
        produceName: "Banana",
        farmerId: "F-214",
        buyerId: "B-1001",
        farmerName: "K. Arumugam",
        buyerName: "Kongu Agri Traders",
        quantity: 1200,
        unit: "kg",
        status: "open",
      },
      [
        {
          author: "farmer",
          kind: "proposal",
          text: "1200 கிலோ தயார்.",
          locale: "ta",
          bands: bands(3600, 3000, 2200),
          ago: 190,
        },
        {
          author: "buyer",
          kind: "proposal",
          text: "Rate is soft this week. This is what I can do today.",
          locale: "en",
          bands: bands(3100, 2600, 1900),
          ago: 176,
        },
        {
          author: "farmer",
          kind: "note",
          text: "நேற்று 34 ரூபாய் கொடுத்தார்கள்.",
          locale: "ta",
          ago: 168,
        },
        {
          author: "farmer",
          kind: "proposal",
          text: "இதுக்கு கீழ முடியாது.",
          locale: "ta",
          bands: bands(3400, 2850, 2100),
          ago: 165,
        },
        {
          author: "buyer",
          kind: "proposal",
          text: "Meeting you most of the way. Loading tomorrow 6am if we agree.",
          locale: "en",
          bands: bands(3300, 2750, 2000),
          ago: 22,
          validForMinutes: 120,
        },
      ],
      now,
    ),

    // Buyer's offer expires in minutes. The screen has to make that obvious.
    thread(
      {
        id: "N-4103",
        listingId: "L-4788",
        produceName: "Green chilli",
        farmerId: "F-219",
        buyerId: "B-1001",
        farmerName: "M. Selvi",
        buyerName: "Kongu Agri Traders",
        quantity: 260,
        unit: "kg",
        status: "open",
      },
      [
        {
          author: "farmer",
          kind: "proposal",
          text: "பச்சை மிளகாய், 260 கிலோ.",
          locale: "ta",
          bands: bands(7800, 6600, 5000),
          ago: 95,
        },
        {
          author: "buyer",
          kind: "proposal",
          text: "Holds until 4pm — after that the lorry is committed elsewhere.",
          locale: "en",
          bands: bands(7400, 6300, 4800),
          ago: 88,
          validForMinutes: 97,
        },
      ],
      now,
    ),

    // Settled. Kept in the list because the thread is the commercial record of
    // how the price was reached.
    thread(
      {
        id: "N-4104",
        listingId: "L-2004",
        produceName: "Onion",
        farmerId: "F-241",
        buyerId: "B-1001",
        farmerName: "T. Ezhilarasi",
        buyerName: "Kongu Agri Traders",
        quantity: 40,
        unit: "bag",
        status: "agreed",
        agreedBands: bands(138_000, 118_000, 92_000),
        agreedAt: new Date(now - 5 * HOUR),
      },
      [
        {
          author: "farmer",
          kind: "proposal",
          text: "40 மூட்டை.",
          locale: "ta",
          bands: bands(145_000, 124_000, 96_000),
          ago: 400,
        },
        {
          author: "buyer",
          kind: "proposal",
          locale: "en",
          bands: bands(138_000, 118_000, 92_000),
          ago: 340,
        },
        {
          author: "farmer",
          kind: "accept",
          text: "சரி.",
          locale: "ta",
          bands: bands(138_000, 118_000, 92_000),
          ago: 300,
        },
      ],
      now,
    ),

    // Walked away, with the reason recorded. A farmer is owed the reason.
    thread(
      {
        id: "N-4105",
        listingId: "L-2005",
        produceName: "Drumstick",
        farmerId: "F-243",
        buyerId: "B-1001",
        farmerName: "N. Chandran",
        buyerName: "Kongu Agri Traders",
        quantity: 420,
        unit: "kg",
        status: "withdrawn",
      },
      [
        {
          author: "farmer",
          kind: "proposal",
          locale: "ta",
          bands: bands(6000, 5200, 4000),
          ago: 900,
        },
        {
          author: "buyer",
          kind: "withdraw",
          text: "Filled this order from Pennagaram. Sorry — will come back next week.",
          locale: "en",
          ago: 870,
        },
      ],
      now,
    ),
  ];
}
