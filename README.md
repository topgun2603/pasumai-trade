# Pasumai Trade

A farm-to-business produce marketplace and logistics platform for Tamil Nadu,
built to scale across India.

Farmers list what they have grown. Buyers bargain a price against it, grade by
grade. A vehicle collects from the farm, the produce is graded in front of the
farmer, and the money settles to their account. Four surfaces, one codebase:

| Surface | Route | Who uses it |
| --- | --- | --- |
| Marketplace | `/market`, `/bargains`, `/orders` | Buyers and franchises |
| Supply | `/listings`, `/dispatch`, `/farmers` | The same accounts, sourcing side |
| Admin console | `/admin/*` | Operations |
| Public site | `/[locale]` | Everyone, in six languages |

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the Firebase config
npm run dev
```

`.env.example` documents every variable, including which are public and which
are genuinely secret. Without Firebase credentials the app still runs — every
screen falls back to seeded sample data and says so on screen rather than
pretending to be connected.

```bash
npm run seed     # write the sample data to Firestore (idempotent, never deletes)
npm test         # domain tests
npm run lint
npm run build
```

## How it is put together

- **Next.js 16** with the App Router and Turbopack. Middleware is `proxy.ts`
  here, and it is not an auth layer.
- **React 19** with the React Compiler. `setState` in an effect is a lint
  error, not a style preference.
- **Firebase** — the client SDK reads, the Admin SDK writes. Security Rules
  deny every client write, so mutations go through route handlers.
- **Tailwind 4** and shadcn/ui on Radix primitives.
- **Vitest** for the domain layer.

### Where the thinking lives

`lib/domain/` is the part worth reading first. It has no React and no Firebase
in it, and it holds the rules that matter:

- `money.ts` — integer paise, never floats. Rounds half away from zero, because
  `Math.round(-2.5)` is `-2` and money must settle at `-3`.
- `order-state.ts` — two order lifecycles with guards that **fail closed**. If
  the context needed to check a rule is missing, the transition is refused.
  These gates stand between produce and money, so "unknown" must never mean
  "yes".
- `negotiation.ts` — price bargaining. Every proposal prices all three grades,
  nobody accepts their own offer, and no party may walk back an offer the other
  side is still considering.
- `distance.ts` — distance is a property of a *pair*, never of a village. It is
  computed from coordinates against whoever is asking.
- `controls.ts` — an allowlist of what operations may edit, and the shape each
  record must satisfy.

### Reference data is data

Crop names, villages, packs, notification templates, document requirements and
the numbers the rules read all live in Firestore and are edited from
**Admin → Controls**. A crop operations cannot rename is a crop a farmer cannot
find in their picker, and waiting for a deploy to fix a word is how a catalogue
ends up wrong for a season.

Crop names are held per language *as data* for the same reason — the same crop
genuinely goes by different names across Tamil Nadu, and `regional` overrides
let a district use the word its farmers actually use.

## Deploying

Every push and pull request runs lint, type check, tests and a build; only if
all four pass does anything deploy. Pull requests get a preview URL, `main`
goes to production. See [DEPLOYMENT.md](DEPLOYMENT.md) for setup — **read the
warning at the top of it before the first production deploy**, because the
consoles show farmer personal data and nothing authenticates yet.

## Known gaps

Read these before deploying anything.

- **Authentication is not connected.** Signing in does not verify anyone. The
  write endpoints under `/api/controls` and `/api/negotiations` hold Admin
  credentials and cannot yet tell who is calling, so they return 404 in
  production and the consoles show a read-only banner. Each has a marked place
  to add `verifySession()`.
- **Agreement does not yet create an order.** A settled bargain is recorded and
  flagged, but wiring it to money needs auth first.
- **Bargains never expire.** The silence timeout is configurable and nothing
  sweeps on it yet.
- Translations need review by native speakers before release.

## Data safety

Never commit a service account key. `.gitignore` excludes `.env*`,
`service-account*.json` and `*-firebase-adminsdk-*.json`; the Admin SDK bypasses
Security Rules entirely, so one of those keys grants total access to the
project.

Collect **masked Aadhaar only** — first eight digits obscured, or offline
e-KYC — and retain only the last four digits.
