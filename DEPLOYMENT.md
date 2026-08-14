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

## Read this before the first production deploy

**Authentication is not connected.** Signing in does not verify anyone.

The write endpoints already refuse in production — `/api/controls/*` and
`/api/negotiations/*` return 404 there, and the consoles show a read-only
banner — so nobody can *change* anything. But the console pages still render,
and `/admin/farmers`, `/admin/buyers` and `/admin/drivers` show names, mobile
numbers, bank account tails and document references. That is personal data of
real farmers, readable by anyone with the URL.

Until `verifySession()` is wired up, put the whole deployment behind Vercel's
own gate:

> Vercel → Project → Settings → **Deployment Protection** → Vercel
> Authentication (team members only), or Password Protection for a shared
> password.

This covers production and previews together. Turn it off when real auth lands,
not before.

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

`vercel.json` pins functions to `bom1` (Mumbai). The Firestore database is in
`asia-south1`, and every server render reads from it — running the functions in
the default US region would add roughly 250 ms of round trip to each query, on
top of the distance to users who are all in India.

If you move the Firestore region, move this too. They must stay together.

---

## Running it manually

```bash
vercel                # preview deploy from your machine
vercel --prod         # production
```

Useful for a one-off, but it bypasses every gate in the pipeline. Prefer a pull
request.
