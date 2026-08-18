/**
 * English — the source of truth.
 *
 * Every other dictionary is typed against this shape, so a missing key is a
 * build error rather than a blank space on a page. Keep the keys descriptive
 * of purpose rather than of position: `hero.title`, not `text1`.
 */
export const en = {
  nav: {
    howItWorks: "How it works",
    pricing: "Pricing",
    languages: "Languages",
    forFarmers: "For farmers",
    forBuyers: "For buyers",
    coverage: "Coverage",
    signIn: "Sign in",
    registerFree: "Register free",
    menu: "Menu",
    language: "Language",
    theme: "Colour theme",
  },

  doors: {
    label: "Sign in as",
    admin: "Admin",
    farmer: "Farmer",
    franchise: "Franchise",
    buyer: "Buyer",
    transport: "Transportation",
    manpower: "Manpower",
  },

  hero: {
    cardCrop: "Tomato · 800 kg",
    cardSettled: "Settled",
    cardGrade: "Grade",
    cardNote: "Grade A only, agreed by the farmer and the buyer. Illustrative.",
    badge: "Tamil Nadu · {districts} districts · {farmers} farmers",
    titleLine1: "Empowering Farmers.",
    titleLine2: "Building A Greener Future.",
    body: "Pasumai Trade connects farmers and buyers on one trusted platform. Fair trade. Better prices. Sustainable tomorrow.",
    imageAlt:
      "Terraced farmland with a collection shed and a goods vehicle on the road",
    statPoints: "Villages covered",
    statDistricts: "Districts",
    statFarmers: "Farmers registered",
    statGrades: "Grades priced up front",
    statSettlement: "Typical settlement",
  },

  promises: {
    fairTitle: "Fair price",
    fairBody: "You and the buyer settle it. Nobody else sets a number.",
    gradedTitle: "Graded once",
    gradedBody: "In front of you, at your gate. The grade decides the price you agreed for it.",
    networkTitle: "Real network",
    networkBody: "Verified buyers, drivers and crew — every document checked.",
    paidTitle: "Paid on delivery",
    paidBody: "Money is held from the order and released when it arrives.",
  },

  prices: {
    title: "Today's prices",
    body: "What farmers and buyers agreed on today. We do not set any price — the two people trading decide it.",
    refresh: "Refresh",
    loading: "Loading today's prices",
    sources: "{count} sales today",
    noSettled: "First price today",
    example: "Example price",
    signInToBid: "Sign in as buyer or franchise",
    notAvailable: "Not on the market yet",
    bidOn: "Sign in to bid for {crop}",
    allIllustrative:
      "Nothing has sold on the platform today yet, so these are example prices showing how this section reads. Real prices take their place the moment a bargain closes.",
    someIllustrative:
      "{count} of these are examples — those crops have not traded today. The others are real prices farmers and buyers agreed on.",
    location: "location",
    locations: "locations",
    fresh: "Fresh",
    useSoon: "Use soon",
    endOfLife: "Today only",
    error:
      "Prices did not load. They change through the day, so an old price is worse than none.",
    retry: "Try again",
    disclaimer:
      "Transport cost is not included. The grade is checked when the produce is collected. These are prices real farmers and buyers agreed on — not a rate we set or publish.",
  },

  languages: {
    eyebrow: "Six languages",
    title: "A farmer sees the word their village uses",
    body: "Crop names are held per language as data, not translation files — because the same crop genuinely goes by different words across Tamil Nadu, and a picker full of words nobody says is a picker nobody uses.",
    caption: "Crop names across the six languages the platform speaks",
  },

  bargain: {
    title: "The price is not ours to set",
    body: "There is no published rate to check an offer against, because there is no offer we made. A farmer names a price, a buyer counters, and the two of them settle it — grade by grade, and only the grades they both want.",
    caption: "Grade A · ₹24/kg · 800 kg",
  },

  how: {
    eyebrow: "How a load moves",
    step1Title: "List what you have",
    step1Body: "Crop, quantity, photos — from the field, and it syncs when signal returns.",
    step1Alt: "A farmer standing at the edge of a field, entering a crop listing on a phone",
    step2Title: "Settle the price",
    step2Body: "A buyer offers, you counter. Bid on one grade or all three — whatever is agreed is what moves.",
    step2Alt: "Hands holding a phone showing grade prices being agreed",
    step3Title: "Collected and graded",
    step3Body: "A vehicle comes to the farm. Grading happens in front of you; a code confirms handover.",
    step3Alt: "A loaded goods vehicle on a rural road",
    step4Title: "Money reaches you",
    step4Body: "Held from the moment the buyer ordered, released once delivery is confirmed.",
    step4Alt: "Hands holding a seedling in soil",
    title: "How a load moves",
    body: "Produce is graded once, in front of the farmer, at the point it is collected. Everything downstream — the price, the payout, the buyer's invoice — resolves from that single grading.",
    caption: "One grading, in front of the farmer, settles the price for everyone.",
    farm: "Farm",
    farmSub: "listing created",
    collection: "Pickup",
    collectionSub: "graded at the farm",
    transit: "In transit",
    transitSub: "checked vehicle",
    buyer: "Buyer",
    buyerSub: "confirms receipt",
    held: "Buyer's payment is held from the moment the order is placed",
    released: "released",
    moneyNote:
      "Money only reaches the farmer after the buyer confirms the load arrived.",
    diagramAlt:
      "A load moves from the farm, through grading at the farm, to the buyer. The buyer's payment is held from order until delivery is confirmed, then released to the farmer.",
  },

  farmers: {
    badge: "For farmers",
    title: "Sell without leaving the field",
    body1:
      "Built for a budget Android phone in bright sunlight, one-handed, with patchy signal. Your language first.",
    body2:
      "You are never asked to accept a number you did not agree to. A buyer offers, you counter, and neither side can walk an offer backwards once it is made. What you settle on is what is written down.",
    imageAlt:
      "Graded produce stacked in crates at the farm gate, with weighing scale and inspection sheet",
    step1Title: "List what you have",
    step1Body:
      "Crop, quantity, photos. It works with no signal — the listing syncs when you are back in range.",
    step2Title: "Check the offer",
    step2Body:
      "An offer names the grades the buyer wants and what they will pay for each. Counter it, or accept — the thread is the record of how you got there.",
    step3Title: "Hand over with a code",
    step3Body:
      "A vehicle comes to the farm. Grading happens in front of you; four digits confirm the handover.",
    step4Title: "Get paid",
    step4Body:
      "Money is held from the moment the buyer orders and lands in your account once delivery is confirmed.",
  },

  buyers: {
    badge: "For buyers and franchises",
    title: "Bulk produce, priced by agreement",
    body: "Franchises and independent bulk buyers get the same console and the same capabilities. Browse graded stock, order what you need, and have it collected and delivered.",
    imageAlt:
      "The buyer console showing graded stock lines with prices, grades and a dispatch summary",
    cta: "Sign in to the buyer console",
    step1Title: "Browse graded stock",
    step1Body:
      "Real availability near you, priced per unit, with grade and remaining shelf life on every line.",
    step2Title: "Pay on order",
    step2Body:
      "No credit and no ledger to reconcile. Funds are held until you confirm receipt.",
    step3Title: "Dispatch included",
    step3Body:
      "Licence, insurance, fitness and permit are checked before a load moves. One vehicle run per district.",
    step4Title: "Confirm and close",
    step4Body:
      "Confirm receipt and the money is released. Anything short or off-grade is raised before it settles.",
  },

  trust: {
    title: "Why both sides can go first",
    body: "Trade between strangers usually stalls on who takes the risk. These are the four rules that remove the question.",
    item1Title: "Everyone is checked",
    item1Body:
      "Buyers submit GST, PAN and an FSSAI licence. Farmers are onboarded in person by a franchise. Nobody transacts before operations approves them.",
    item2Title: "Graded once, in the open",
    item2Body:
      "Produce is graded at collection with the farmer present. All three grade prices are agreed before the vehicle is sent, so nothing is renegotiated at the roadside.",
    item3Title: "Money is held, not passed on",
    item3Body:
      "The buyer's payment is held from order until delivery is confirmed. Neither side is asked to go first.",
    item4Title: "No lapsed paperwork on the road",
    item4Body:
      "A vehicle with an expired certificate cannot be assigned to a load, and a driver with an expired licence cannot be dispatched. The system refuses it.",
  },

  drivers: {
    badge: "For drivers",
    title: "Steady runs, paid per trip",
    body: "Own a mini truck, tempo or reefer? Register it with your licence, RC, insurance, fitness certificate and permit, and take collection runs in your district. We tell you before a certificate is close to lapsing rather than after.",
    cta: "Register a vehicle",
  },

  coverage: {
    title: "Where we collect",
    body: "Produce is collected at the farm and graded in front of the farmer. These are the villages we reach.",
    farmers: "farmers",
    openingSoon: "Opening soon",
    mapUnavailable: "The map could not be loaded. The villages are listed below.",
    mapLabel: "Map of the villages we collect from",
    illustrative:
      "Example coverage. These are the villages the platform ships with, not the live list — the real one appears as soon as it can be read.",
  },

  faq: {
    title: "Questions we are asked",
    body: "Something not covered here? Send an enquiry below and operations will call you back.",
    q1: "What does it cost a farmer?",
    a1: "Nothing to list, and nothing deducted for transport. The price you accept is the price that settles, adjusted only by the grade recorded in front of you at collection and by the actual weight loaded.",
    q2: "How quickly are farmers paid?",
    a2: "Money is released once the buyer confirms the load arrived, and typically reaches the account within a day. You see the last four digits of the account it went to, so you can check without calling anyone.",
    q3: "Do buyers get credit?",
    a3: "No. Every order is paid in full when it is placed. There is no balance to reconcile, no interest, and no collections.",
    q4: "What happens if the grade is disputed?",
    a4: "The load is held. A farmer who disputes the recorded grade stops the produce moving until it is resolved — moving it first would settle the argument in the buyer's favour by default.",
    q5: "What if produce arrives short or off-grade?",
    a5: "Raise it before you confirm receipt. Money is only released on your confirmation, so a shortfall is settled while the funds are still held rather than chased afterwards.",
    q6: "Which languages does it work in?",
    a6: "English, Tamil, Telugu, Kannada, Malayalam and Hindi. Crop names are held per language and per district because they vary regionally — what is one crop in Erode may be called something else in Thanjavur.",
  },

  apply: {
    title: "Register free",
    body: "Accounts are opened by our operations team after documents are checked. Buyers need GST, PAN and an FSSAI licence; farmers are onboarded by a franchise, who collects bank details in person.",
    haveAccount: "Already have an account?",
    signInHere: "Sign in here",
    iWantTo: "I want to",
    buyProduce: "Buy produce in bulk",
    sellProduce: "Sell produce I grow",
    yourName: "Your name",
    mobile: "Mobile",
    businessName: "Business name",
    district: "District",
    optional: "optional",
    whatBuy: "What do you buy?",
    whatGrow: "What do you grow?",
    send: "Send enquiry",
    sending: "Sending…",
    note: "We will call to arrange document checks. Accounts are opened by operations, never automatically.",
    successTitle: "Enquiry received",
    successBody:
      "Operations will call you on the number you gave to arrange document checks.",
  },

  signin: {
    franchiseBlurb: "Contracted franchises. Same console and same capabilities as an independent buyer.",
    transportBlurb: "Transport contractors. Register your vehicles and drivers; operations verifies them.",
    manpowerBlurb: "Labour contractors. Register your loading, grading and weighing crew.",
    otherDoors: "Signing in as someone else?",
    agency: "Agency",
    agencyBlurb: "Transport and manpower contractors. Register your vehicles, drivers and crew; operations verifies them.",
    title: "Sign in to Pasumai Trade",
    subtitle: "Choose the console you work in.",
    buyer: "Buyer",
    operations: "Operations",
    farmer: "Farmer",
    buyerBlurb:
      "Franchises and independent bulk buyers. Browse graded stock, place orders and track dispatch.",
    adminBlurb:
      "Platform administration. Approve accounts, manage the fleet and watch document expiry.",
    farmerBlurb:
      "Sign in with the mobile number your franchise registered. You will receive a one-time code.",
    email: "Email address",
    mobile: "Mobile number",
    password: "Password",
    forgotten: "Forgotten?",
    submit: "Sign in",
    sendCode: "Send one-time code",
    signingIn: "Signing in…",
    sendingCode: "Sending code…",
    noAccount: "No account?",
    requestOne: "Request one",
    accountsNote: "accounts are opened by operations after documents are checked.",
    notConnectedTitle: "Authentication is not connected yet.",
    notConnectedBody:
      "Signing in here does not verify anyone — it opens the console so the surfaces can be reviewed. Do not deploy this publicly until Firebase Auth and session cookies are wired up.",
  },

  footer: {
    tagline: "Farm-to-business produce trade and logistics for Tamil Nadu.",
    platform: "Platform",
    signIn: "Sign in",
    buyerOrFranchise: "Buyer or franchise",
    operations: "Platform operations",
    allOptions: "All sign-in options",
    contact: "Contact",
    rights: "All rights reserved.",
    rateNote:
      "Prices shown are agreed between farmers and buyers on the platform. They are not a published index and the platform does not set them.",

    /* The terms, said plainly. Each of these is a rule the code enforces —
       see the note in components/marketing/site-footer.tsx. */
    joinTitle: "Anyone can register.",
    joinBody:
      "Browsing the market is free. Posting produce, bargaining and booking transport need a plan.",
    registerCta: "Register free",
    seePlans: "See plans",

    terms: "Terms",
    termsHeading: "How this works",
    termFree: "Registering and browsing the market costs nothing.",
    termPlan: "A plan is needed to post produce, bargain, or arrange transport.",
    termVerify:
      "Accounts are verified before trading. eKYC clears at once; documents checked by hand wait for operations.",
    termPrice:
      "Every price is settled between a farmer and a buyer. The platform never quotes, sets or guarantees one.",
    termGrade:
      "Grading happens at the farm gate with both sides present, and a grade priced in a bargain is not reopened there.",
    termBinding: "Nothing binds either side until one of them accepts.",
    termPartial:
      "A lot may be sold in parts. What nobody takes stays on the market.",
    termLanguage:
      "Bargain messages come from a fixed list, so each side reads them in their own language.",

    languages: "Spoken here",
    address: "Coimbatore, Tamil Nadu, India",
    email: "org@srirealtime.com",
    writeToUs: "Write to us",
  },

  common: {
    required: "required",
    changeLanguage: "Change language",
  },
};

/**
 * The shape every dictionary must satisfy.
 *
 * Deliberately *not* `as const`: literal types would make the English strings
 * the only permitted values, so no translation could ever be assigned. What
 * matters here is that the keys match, which a missing one makes a build
 * error.
 */
export type Dictionary = typeof en;
