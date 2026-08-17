# Deploying

CI and deployment both run from [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
Every push and pull request runs lint, type check, tests and a build; only if
all four pass does anything deploy. A pull request gets a preview URL, and a
push to `main` goes to production followed by a smoke test against the live
URL.

Deployment is driven by the workflow rather than by Vercel's Git integration,
because that integration deploys on every push whether or not the tests passed.
The order guards fail closed and the bargaining rules decide what a farmer is
paid — a red build must not be able to reach production. `vercel.json` turns
the automatic deploy off for `main`.

---

## Accounts and access

Every console route is behind a session. Signed out, `/admin`, `/market`,
`/bargains` and everything under them redirect to sign-in, and every write
endpoint answers 401.

**There is no self sign-up.** A buyer is verified against a GST number before
they may order, and a farmer is onboarded by a franchise — so accounts are
issued by operations, not requested by strangers. That also means the first
account has to be minted from outside the application, because the console that
grants roles is itself behind the console.

### Enable the sign-in provider

Once per project: Firebase console → Authentication → Sign-in method →
**Email/Password** → enable. Without it every sign-in fails with
`PASSWORD_LOGIN_DISABLED`, which the form reports as "Sign-in is not
configured on this deployment."

### Create accounts

```bash
npm run grant -- admin  ops@yourdomain.in
npm run grant -- buyer  purchasing@buyer.in   B-1001
npm run grant -- farmer murugan@example.in    F-201
```

Needs `FIREBASE_SERVICE_ACCOUNT_KEY`, so it is run by whoever holds the service
account. It creates the user if absent, prints a generated password **once**,
sets the role and account id as custom claims, and ends any existing sessions.

Buyers and farmers must pass the id of their record on the platform — every
Security Rule scoped to "your own records" compares against it, and the script
refuses an id that matches no document rather than issuing a claim that points
at nothing.

Re-run it to change a role or issue a new password. It never deletes a user.

### Who may do what

| | Operations | Buyer |
| --- | --- | --- |
| `/admin/*` | yes | redirected to `/market` |
| `/market`, `/bargains`, `/orders` | yes | yes |
| Edit Controls | yes | 403 |
| Speak in a bargain | **no** | only their own |

Operations are deliberately barred from posting in a bargain. They can read
every thread — a price the platform itself could quietly agree to is a price
the written record could not vouch for.

The party to a bargain is derived from the session, never from the request. A
buyer posting `author: "farmer"` is recorded as the buyer.

### Deployment protection

Vercel → Project → Settings → **Deployment Protection** is no longer the only
thing standing between the internet and farmer personal data, but it is still
worth having on previews: a preview deploy of a branch is a full copy of the
console pointed at the same Firestore project.

---

## One-time setup

### 1. Create the Vercel project

```bash
npm install --global vercel
vercel login
vercel link          # answer: link to existing project, or create "pasumai-trade"
```

`vercel link` writes `.vercel/project.json`, which holds the two ids you need
below. That directory is gitignored — it is machine-local, not shared config.

### 2. Environment variables in Vercel

Vercel → Project → Settings → **Environment Variables**. Set these for
**Production, Preview and Development**:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public. Identifies the project, does not authenticate. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Optional |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional — omit to disable Analytics |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Secret.** Service account JSON, base64 on one line. |

`NEXT_PUBLIC_*` values are **inlined at build time**, not read at runtime. If
they are missing when Vercel builds, the deployed bundle has no Firebase config
and no amount of setting them afterwards will fix it — you have to redeploy.

The app compiles and renders without any of them (CI proves this on every run,
building with none set), falling back to sample data and saying so on screen.
That is a development convenience, not a production state.

`FIREBASE_SERVICE_ACCOUNT_KEY` grants total access to the project — the Admin
SDK bypasses every Security Rule. Set it as a secret, never as a plain value,
and never in a `NEXT_PUBLIC_` variable.

### 3. GitHub secrets

GitHub → repo → Settings → Secrets and variables → **Actions**:

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

Scope the token to the one project rather than the whole account.

### 4. Protect `main`

GitHub → Settings → Branches → add a rule for `main`: require a pull request,
and require the **`Lint, types, tests, build`** check to pass. Without this the
gate is advisory — anyone can push straight to `main` and the deploy job will
happily run after a failed `quality` job is skipped.

---

## Firestore rules and indexes

**Vercel does not deploy these.** They live in the Firebase project, and a
change to `firestore.rules` or `firestore.indexes.json` has no effect until it
is pushed separately:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Deliberately kept manual. Rules are the entire security boundary for client
reads, and a bad deploy of them is not something to discover from a green
pipeline. Review the diff, deploy, then verify by attempting a read you expect
to be refused.

---

## Region

`vercel.json` pins functions to `bom1` (Mumbai), which is right: every user is
in India.

**The Firestore database is not.** It is in `nam5`, a US multi-region — this
document previously said `asia-south1`, and that was wrong. Check it rather
than trust either claim:

```bash
npm run check:region
```

That reads the live project and prints the location. It matters twice over:

- **Every server render crosses the Pacific.** A page in Mumbai reading a
  database in Iowa pays roughly 250 ms per round trip, and the consoles make
  several. This is the cost the paragraph above believed it had avoided.
- **It decides where the notification triggers can run.** See below.

A Firestore location is fixed for the life of the database. Moving to
`asia-south1` means creating a database there and migrating the data — not a
setting to flip, and worth planning rather than discovering.

---

## Notification functions

The bell on both consoles is fed by Cloud Functions in [`functions/`](functions/),
triggered by writes to `listings`, `negotiations` and `buyerOrders`. They watch
documents rather than being called by the application, so a bargain settled by a
script or by an operator reaches the notification list the same as one settled
in the console.

```bash
npm run check:region          # which region the triggers must be in, and why
npm --prefix functions ci     # first time only
npx firebase-tools deploy --only functions
```

Deploy as an **Owner** of the project, not with the service account. A first
2nd-gen deploy grants roles to three Google-managed service agents — Pub/Sub
needs `iam.serviceAccountTokenCreator`, the runtime identity needs
`eventarc.eventReceiver`, and Eventarc needs its own agent role — and writing
those needs `resourcemanager.projects.setIamPolicy`, which the Admin SDK
service account does not have and should not be given.

### "We failed to modify the IAM policy for the project"

The CLI reports most setup problems as that one sentence, and it points at the
wrong place. Run this first:

```bash
npm run check:deploy
```

It checks the chain in the order it actually breaks — plan, APIs, service
agents, bindings — and prints the commands for whatever is missing. It changes
nothing.

The binding the CLI could not write is usually rejected because **the principal
does not exist**, not because permission was refused. Service agents are
provisioned lazily: a project that has never run Eventarc or Pub/Sub has no
such account to grant a role to, and granting a role to an account that is not
there fails. Underneath that, the usual reason nothing has been provisioned is
that the project is still on **Spark** — 2nd-gen functions require Blaze, full
stop.

So, in order: Blaze, then `compute.googleapis.com` (2nd-gen functions run on
Cloud Run and use the Compute Engine default service account as their runtime
identity), then

```bash
gcloud beta services identity create --service=pubsub.googleapis.com   --project=pasumai-trade
gcloud beta services identity create --service=eventarc.googleapis.com --project=pasumai-trade
```

which provisions the two agents explicitly. Propagation takes a few minutes —
an immediate retry can still fail. Then deploy as an Owner and the CLI writes
the bindings itself.

A second, unrelated cause of the same message: the CLI resolves the project
from `projects.default` in `.firebaserc`, and with no default alias it fails to
identify the project and reports *that* as an IAM problem too. `npx
firebase-tools functions:list` with no `--project` flag tells you in one
command whether resolution works.

### The region, and why it is not Mumbai

A 2nd-gen Firestore trigger is an [Eventarc](https://firebase.google.com/docs/functions/firestore-events)
trigger, and Eventarc delivers a Firestore event **in the database's own
location**. Multi-regions are not supported directly; each maps to one region:

| Firestore location | Trigger region |
| --- | --- |
| `nam5` (US multi) | `us-central1` |
| `eur3` (EU multi) | `europe-west1` |
| `asia-south1` (Mumbai) | `asia-south1` |

So while `asia-south1` is a perfectly good Cloud Functions region — Tier 2,
2nd-gen only, which is all these need — a trigger cannot be put there while the
data it watches is in `nam5`. Deploying it there does not run slowly; it fails.

The region lives in one place, [`functions/src/region.ts`](functions/src/region.ts),
with `INTENDED` recording where we want to be. When the database moves, change
`REGION` and every trigger follows. `npm run check:region` fails loudly if the
two disagree.

### What the handlers must guarantee

Firestore events are delivered **at least once** and in **no guaranteed order**.
Both are handled and both matter:

- Duplicates are absorbed by making the event id part of the document id, and
  writing with `create` rather than `set` — a redelivery collides and is
  ignored, rather than overwriting a notification somebody has already read.
- Nothing reasons about history beyond the `before`/`after` pair the event
  carries, so an out-of-order delivery cannot produce a wrong conclusion.

Notifications are written to `accounts/{accountId}/notifications`. The account
is the path rather than a field, so the Security Rule cannot be widened by a
cleverer query, and one account's feed needs no composite index.

---

## Running it manually

```bash
vercel                # preview deploy from your machine
vercel --prod         # production
```

Useful for a one-off, but it bypasses every gate in the pipeline. Prefer a pull
request.
