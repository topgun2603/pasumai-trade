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

It answers before the app does, though, which the post-deploy smoke test walks
straight into: an unauthenticated request to a generated deployment URL gets a
302 to `vercel.com/sso-api`, so every check fails on a page that was never
loaded. The fix is the supported bypass rather than turning protection off:

  Deployment Protection → **Protection Bypass for Automation** → generate the
  secret, then add it under GitHub → Settings → Secrets and variables →
  Actions as `VERCEL_AUTOMATION_BYPASS_SECRET`.

`.github/scripts/smoke-test.sh` sends it as `x-vercel-protection-bypass`. Leave
it unset and the step still runs, but it says plainly that this is why
everything came back 302.

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

## Workload Identity Federation

The Admin SDK needs credentials, and this organisation forbids the obvious
kind. `iam.disableServiceAccountKeyCreation` is enforced, so the service
account JSON that `FIREBASE_SERVICE_ACCOUNT_KEY` wants cannot be downloaded at
all. That is the right policy: a downloaded key is long-lived, rotates only
when somebody remembers to, and bypasses every Security Rule if it leaks.

Federation replaces it. Vercel issues each deployment a short-lived OIDC token
saying which project and environment it is. Google trusts that issuer and
exchanges the token for an access token impersonating a service account. No key
exists at any point, and the credential expires within the hour.

Enable it on the Vercel side first — Project → Settings → **Secure Backend
Access (OIDC)**. Without it no token is issued and the exchange has nothing to
present. That page also shows the issuer URL and audience for your team; use
what it shows rather than the placeholders below, which differ by team slug and
have changed before.

Then, as an Owner, in [Cloud Shell](https://shell.cloud.google.com/?project=pasumai-trade-7c83a):

```bash
PROJECT=pasumai-trade-7c83a
NUMBER=447458551837
TEAM=sri-real-time-erp
SA=pasumai-trade-runtime@$PROJECT.iam.gserviceaccount.com

# The identity a deployment acts as. Firestore, Auth and Storage, nothing else
# — this is not the place for roles/editor.
gcloud iam service-accounts create pasumai-trade-runtime \
  --project=$PROJECT --display-name="Pasumai Trade runtime"

for ROLE in roles/datastore.user roles/firebaseauth.admin roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" --role="$ROLE"
done

# The pool, holding the trust in Vercel's issuer.
gcloud iam workload-identity-pools create vercel \
  --project=$PROJECT --location=global --display-name="Vercel"

gcloud iam workload-identity-pools providers create-oidc vercel \
  --project=$PROJECT --location=global --workload-identity-pool=vercel \
  --issuer-uri="https://oidc.vercel.com/$TEAM" \
  --allowed-audiences="https://vercel.com/$TEAM" \
  --attribute-mapping="google.subject=assertion.sub,attribute.project=assertion.project_id,attribute.environment=assertion.environment"

# Only this project's deployments may impersonate it. Without the attribute
# scope, every deployment on the team could — including someone else's.
gcloud iam service-accounts add-iam-policy-binding $SA --project=$PROJECT \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/vercel/attribute.project/prj_foxtfXJrUwFUECBwhSl7juBoGAlX"
```

Then set these in Vercel → Settings → Environment Variables, leaving
`FIREBASE_SERVICE_ACCOUNT_KEY` unset — where a key is present it wins, so a
leftover one silently keeps federation switched off:

| Variable | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_AUDIENCE` | `//iam.googleapis.com/projects/447458551837/locations/global/workloadIdentityPools/vercel/providers/vercel` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `pasumai-trade-runtime@pasumai-trade-7c83a.iam.gserviceaccount.com` |

`VERCEL_OIDC_TOKEN` is injected by Vercel at runtime. Do not set it by hand.

### On a development machine

`vercel env pull` writes a `VERCEL_OIDC_TOKEN` into `.env.local` and the same
path works locally. It is short-lived, so pull again when it expires.

Simpler for day-to-day work, and what `npm run check:region` and
`npm run check:deploy` fall back to when no key is set:

```bash
gcloud auth application-default login
```

That leaves Application Default Credentials in a well-known file, which the SDK
finds by itself — no key, no token, no variable to set. Those two read the
project id from `NEXT_PUBLIC_FIREBASE_PROJECT_ID` when there is no key to take
it from, so that has to be in `.env.local`.

The rest of [`scripts/`](scripts/) — `grant`, `seed`, `link-mobiles`,
`restore-listings`, `set-storage-cors` — still expects
`FIREBASE_SERVICE_ACCOUNT_KEY` and has not been moved across. They write rather
than read, so they are worth converting deliberately rather than in passing.

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

**So is the Firestore database.** It is in `asia-south1` (Mumbai). Earlier
revisions of this document said `nam5`, a US multi-region, and built a good
deal of reasoning on top of that — the project those notes described is not
the one this repo deploys to. Check it rather than trust any claim here:

```bash
npm run check:region
```

That reads the live project and prints the location. It matters twice over:

- **A server render stays in region.** The consoles make several round trips
  per page; against a US database each one crossed the Pacific for roughly
  250 ms. In `asia-south1` that cost is not paid at all.
- **It decides where the notification triggers can run.** See below.

A Firestore location is fixed for the life of the database, so if this is ever
wrong it is not a setting to flip: it means creating a database in the right
place and migrating the data. Worth planning rather than discovering.

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
gcloud services enable compute.googleapis.com --project=pasumai-trade-7c83a
gcloud beta services identity create --service=pubsub.googleapis.com   --project=pasumai-trade-7c83a
gcloud beta services identity create --service=eventarc.googleapis.com --project=pasumai-trade-7c83a
```

`services identity create` is the part with no Console equivalent: enabling an
API is *supposed* to provision its service agent, and sometimes has not — this
forces it. Propagation takes a few minutes, so an immediate retry can still
fail. Then deploy as an Owner and the CLI writes the bindings itself.

gcloud is not a dependency of this repo and is often not installed. Rather than
download it, run those three in
[Cloud Shell](https://shell.cloud.google.com/?project=pasumai-trade-7c83a) — it is
already signed in as whoever opens it and has gcloud built in.

A second, unrelated cause of the same message: the CLI resolves the project
from `projects.default` in `.firebaserc`, and with no default alias it fails to
identify the project and reports *that* as an IAM problem too. `npx
firebase-tools functions:list` with no `--project` flag tells you in one
command whether resolution works.

### "Gaia id not found for email service-...@gcf-admin-robot..."

A 404 from `cloudfunctions.googleapis.com/.../functions:generateUploadUrl`,
naming `service-<project number>@gcf-admin-robot.iam.gserviceaccount.com`.

The same cause as above, a different agent: this is Cloud Functions' own
service agent, and a first deploy trips over it long before it reaches
Eventarc. "Gaia id not found" means the account **does not exist** — not that
a permission was refused, and not that the API is switched off. Enabling
`cloudfunctions.googleapis.com` is supposed to provision it, and sometimes has
not.

```bash
gcloud beta services identity create --service=cloudfunctions.googleapis.com \
  --project=pasumai-trade-7c83a
```

Propagation takes a few minutes, so an immediate retry can still fail. If the
account still does not appear, check the plan before anything else: on Spark
no agent is provisioned at all, because the project cannot run 2nd-gen
functions in the first place.

`npm run check:deploy` looks for this agent alongside the other three.

### "missing permission on the build service account"

The upload succeeds, three builds start, and all three fail with that sentence
— which names neither the permission nor the account.

A 2nd-gen function is built by Cloud Build, and on a project created since
Google's **Secure by Default** enforcement the builder is the Compute Engine
default service account, not the legacy `<number>@cloudbuild.gserviceaccount.com`
one. The compute default account no longer receives `roles/editor`
automatically, and nothing grants it the builder role in its place. So the
account exists, is perfectly healthy, and simply cannot build — which is why
the service-agent checks above all pass while every build fails.

```bash
gcloud projects add-iam-policy-binding pasumai-trade-7c83a \
  --member="serviceAccount:447458551837-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

`npm run check:deploy` reports this under **build identity**.

### "Changing from an HTTPS function to a background triggered function"

Seen when a previous deploy created the functions while the Pub/Sub and
Eventarc service agents were still missing: the Cloud Run services were made,
the Eventarc bindings were not, and what is left registers as an HTTPS function.
It is inert — nothing calls it, and no Firestore write reaches it.

A trigger type cannot be changed in place. Delete and redeploy:

```bash
firebase functions:delete onProduceListed onBargainActivity onOrderPlaced \
  --region asia-south1 --force
firebase deploy --only functions
```

Nothing is lost: these functions hold no state, and in that condition they were
doing nothing. Check `firebase functions:list` afterwards — the Trigger column
should read the Firestore event type, never `https`.

### The region, and why it is Mumbai

A 2nd-gen Firestore trigger is an [Eventarc](https://firebase.google.com/docs/functions/firestore-events)
trigger, and Eventarc delivers a Firestore event **in the database's own
location**. Multi-regions are not supported directly; each maps to one region:

| Firestore location | Trigger region |
| --- | --- |
| `nam5` (US multi) | `us-central1` |
| `eur3` (EU multi) | `europe-west1` |
| `asia-south1` (Mumbai) | `asia-south1` |

This project's database is in `asia-south1`, so the triggers are there too —
which is also where we want them: Tier 2, 2nd-gen only, which is all these
need, and next to the people using the platform. A trigger cannot be put
anywhere else while the data it watches is in Mumbai. Deploying it elsewhere
does not run slowly; it fails.

The region lives in one place, [`functions/src/region.ts`](functions/src/region.ts),
with `INTENDED` recording where we want to be and `REGION` where the database
puts us. They agree today. If the database ever moves, change `REGION` and
every trigger follows. `npm run check:region` fails loudly if the two
disagree.

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
