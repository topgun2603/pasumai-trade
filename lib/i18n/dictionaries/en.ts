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
    pricing: "Subscription",
    languages: "Languages",
    forFarmers: "For farmers",
    forBuyers: "For buyers",
    coverage: "Coverage",
    signIn: "Sign in",
    registerNew: "Register New",
    menu: "Menu",
    language: "Language",
    theme: "Colour theme",
  },
  brand: {
    name: "Pasumai Trade",
    tagline: "Empowering Farmers",
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
    badge: "Across India",
    titleLine1: "Empowering Farmers.",
    titleLine2: "Building A Greener Future.",
    body: "Pasumai Trade connects farmers and buyers on one trusted platform. Fair trade. Better prices. Sustainable tomorrow.",
    imageAlt:
      "Terraced farmland with a collection shed and a goods vehicle on the road",
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
    body: "Crop names are held per language as data, not translation files — because the same crop genuinely goes by different words across India, and a picker full of words nobody says is a picker nobody uses.",
    caption: "Crop names across the six languages the platform speaks",
  },

  bargain: {
    title: "The price is not ours to set",
    body: "There is no published rate to check an offer against, because there is no offer we made. A farmer names a price, a buyer counters, and the two of them settle it — grade by grade, and only the grades they both want.",
    caption: "Grade A · ₹24/kg · 800 kg",
    badge: "No published rate. No platform price.",
    rule1: "Bid on one grade or all three. A buyer who wants only the top grade says so, and the rest of the lot stays yours to sell.",
    rule2: "Neither side can walk an offer backwards once it is made.",
    rule3: "Nobody can accept their own price — an agreement needs both.",
    rule4: "The thread is the record. What was agreed, and how, stays readable.",
    demo: {
      farmer: "Farmer",
      buyer: "Buyer",
      grade: "Grade",
      settledLabel: "Settled",
      illustrative: "Illustrative",
      play: "Play the example",
      pause: "Pause the example",
      threadLabel: "An example price negotiation",
      rounds: [
        {
          crop: "Tomato",
          lot: "800 kg",
          settled: "Grade A · ₹24/kg",
          steps: [
            "800 kg tomato, picked this morning.",
            "I only need the top grade this week.",
            "Yesterday grade A went at 24.",
            "Meeting you most of the way.",
            "Agreed.",
          ],
        },
        {
          crop: "Banana",
          lot: "1,200 kg",
          settled: "A ₹33 · B ₹27.50 · C ₹20",
          steps: [
            "1,200 kg ready. All three grades.",
            "Rate is soft this week. This is what I can do today.",
            "I cannot go below this.",
            "Splitting the difference. Loading tomorrow at six.",
            "Done.",
          ],
        },
        {
          crop: "Green chilli",
          lot: "260 kg",
          settled: "Grade A · ₹78/kg",
          steps: [
            "260 kg, graded this morning.",
            "I need it today. Taking grade A at your price.",
            "Take it.",
          ],
        },
      ],
    },
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
    showList: "Show the village list",
    hideList: "Hide the village list",
    illustrative:
      "Example coverage. These are the villages the platform ships with, not the live list — the real one appears as soon as it can be read.",
  },

  faq: {
    title: "Questions we are asked",
    body: "The ones that come up most. If yours is not here, ask us — every account can reach operations.",
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
  signup: {
    title: "Create an account",
    subtitle: "Takes a minute. You can sign in and look around straight away.",
    blurbFarmer: "List what you grow, and bargain on your own price.",
    blurbFranchise: "Buy graded produce for a franchise outlet.",
    blurbBuyer: "Buy direct from farmers — hotels, caterers, retailers.",
    blurbTransport: "Register a fleet, then add your vehicles and drivers.",
    blurbManpower: "Register an agency, then add the crew you supply.",
    yourName: "Your name",
    businessName: "Business name",
    agencyName: "Agency name",
    village: "Village",
    town: "Town",
    mobile: "Mobile number",
    code: "Six-digit code",
    send: "Send one-time code",
    sending: "Sending…",
    verify: "Verify and continue",
    checking: "Checking…",
    useEmail: "Use email and password instead",
    registeringElse: "Registering as something else?",
    opsNote: "Operations accounts are not created here — they are issued internally.",
    alreadyRegistered: "Already registered?",
    signIn: "Sign in",
    email: "Email",
    emailPlaceholder: "you@company.in",
    password: "Password",
    passwordHint: "At least 8 characters, with a capital letter, a number and a symbol.",
    confirmPassword: "Confirm password",
    create: "Create account",
    creating: "Creating account…",
    useMobile: "Register with your mobile instead",
    or: "or",
    differentNumber: "Use a different number",
    enterCode: "Enter the six-digit code.",
    codeSent: "Code sent to {mobile}",
    couldNotSend: "Could not send a code.",
    couldNotSignIn: "Could not sign in.",
    unreachable: "Could not reach the server. Check your connection and try again.",
    couldNotCreate: "Could not create the account.",
    createdTitle: "Account created",
    reference: "Your reference is {ref} — worth keeping, it is what operations ask for if you ever phone them.",
    verifySent: "We have sent a link to {email}. Open it to confirm the address is yours — you can sign in and look around before you do.",
    verifyFailed: "We could not send the confirmation email just now. Nothing is wrong with the account — sign in and ask for it again from your account page.",
    whatNow: "What happens now",
    now1: "Sign in now — your account is ready.",
    now2: "Looking around is free: prices, listings and who is buying.",
    now3Farmer: "Take a plan when you want to post produce and bargain.",
    now3Other: "Take a plan when you want to bargain and order.",
    now4: "Verification is in your console, and most of it is instant.",
    mobileRequired: "Mobile number is required.",
    badMobile: "Enter a 10-digit Indian mobile number starting 6–9.",
  },


  signin: {
    google: "Continue with Google",
    useEmail: "Use email and password instead",
    useSms: "Send me a code by SMS instead",
    codeLabel: "Six-digit code",
    wrongNumber: "Wrong number, or no code arrived?",
    noAccountYet: "No account yet?",
    registerAs: "Register as {role}",
    takesAMinute: "— it takes a minute and you can sign in straight away.",
    badMobile: "That is not a valid mobile number.",
    enterCode: "Enter the six-digit code.",
    franchiseBlurb: "Contracted regional partners, overseeing the areas they hold.",
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
      "Independent bulk buyers, sourcing produce on their own account.",
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
    tagline: "Farm-to-business produce trade and logistics for India.",
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
    registerCta: "Register New",
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
    address: "India",
    email: "org@srirealtime.com",
    writeToUs: "Write to us",
  },

  /*
    The farmer console.

    The only console with a dictionary, and the only one that needs one: a
    grower reads this on a handset in the language they think in, while a buyer
    or an agency is a business operating in English. See lib/i18n/console.ts for
    how the language reaches a surface that has no locale in its path.
  */
  /**
   * The rails every non-farm console reads.
   *
   * These were hardcoded English on the grounds that buying and agency
   * are staff surfaces. They are not: a transport owner and a labour
   * contractor run their own businesses on them, exactly as a farmer
   * does, and a language switcher with nothing to switch is worse than
   * no switcher at all.
   */
  console: {
    home: "Home",
    overview: "Overview",
    marketplace: "Marketplace",
    bargains: "Bargains",
    orders: "Orders",
    profile: "My Profile",
    notifications: "Notifications",
    dispatch: "Dispatch",
    farmers: "Farmers",
    platformView: "Platform view",
    buying: "Buying",
    yourArea: "Your area",
    bookTransport: "Book Transport",
    bookOrders: "Book Orders",
    transport: "Transport",
    drivers: "Drivers",
    language: "Language",
    theme: "Colour theme",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    signingOut: "Signing out…",
  },

  farm: {
    nav: {
      home: "Home",
      overview: "Overview",
      produce: "My produce",
      bargains: "Bargains",
      notifications: "Notifications",
      account: "My Profile",
      logistics: "Logistics",
      prices: "Prices",
      verification: "Verification",
      subscription: "Subscription",
      theme: "Theme",
      language: "Language",
      role: "Farmer",
    },
    home: {
      greeting: "Welcome to Pasumai Trade",
      blurb: "Sell what you grow direct to businesses, at a price the two of you agree between yourselves.",
      produce: "List what is ready. Photographs, grades and how much of each.",
      bargains: "Buyers make an offer, you counter. Nothing is binding until you say so.",
      logistics: "Once a price is agreed, the lorry and the collection are ours to arrange.",
      continueLabel: "Continue",
    },
    today: {
      title: "Today",
      produceListed: "Produce listed",
      nothingListed: "Nothing on offer yet",
      waitingOnYou: "Waiting on you",
      buyerSpokeLast: "A buyer has spoken last",
      nothingToReply: "Nothing to reply to",
      agreed: "Agreed",
      priceSettled: "Price settled, binding",
    },
    page: {
      greeting: "Vanakkam",
      postProduce: "Post produce",
      yourProduce: "Your produce",
      seeAll: "See all",
      nothingListedYet: "Nothing listed yet. Post what you have ready and buyers will bargain for it.",
      signOut: "Sign out",
      signingOut: "Signing out…",
    },
    listing: {
      noOffers: "No offers yet",
      offerReceived: "Offer received",
      photo: "photo",
      photos: "photos",
      bargains: "Bargains",
    },
  },
  common: {
    backToTop: "Back to top",
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
