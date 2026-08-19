#!/usr/bin/env bash
#
# Fails the deploy with an actionable message when the Vercel credentials are
# not configured.
#
# Without this the first sign of trouble is the CLI reporting
# `You defined "--token", but it's missing a value` — or, worse, an
# authentication error thirty seconds in — neither of which names the secret
# that is actually missing or says where to get it.
#
# Reads only whether each value is empty. Nothing here echoes a secret.
set -euo pipefail

missing=()
[ -n "${VERCEL_TOKEN:-}" ]      || missing+=("VERCEL_TOKEN")
[ -n "${VERCEL_ORG_ID:-}" ]     || missing+=("VERCEL_ORG_ID")
[ -n "${VERCEL_PROJECT_ID:-}" ] || missing+=("VERCEL_PROJECT_ID")

if [ ${#missing[@]} -eq 0 ]; then
  echo "All three Vercel credentials are present."
  exit 0
fi

echo "::error::Cannot deploy — missing repository secret(s): ${missing[*]}"

cat >&2 <<'EOF'

The build passed; only the deploy is blocked. To connect this repository to
Vercel:

  1. npm install --global vercel
     vercel login
     vercel link            # creates or links the project

     This writes .vercel/project.json, which holds two of the three values
     below. That file is gitignored — it is machine-local, not shared config.

  2. Add these under
     GitHub > Settings > Secrets and variables > Actions:

       VERCEL_TOKEN        Vercel > Account Settings > Tokens > Create.
                           Scope it to this one project, not the whole account.
       VERCEL_ORG_ID       .vercel/project.json -> orgId
       VERCEL_PROJECT_ID   .vercel/project.json -> projectId

  3. Set the Firebase environment variables in the Vercel project itself.
     NEXT_PUBLIC_* values are inlined at build time, so they must be present
     before Vercel builds — setting them afterwards needs a redeploy.

  4. Re-run this workflow.

Full instructions, including the deployment protection to turn on before the
site is public, are in DEPLOYMENT.md.
EOF

exit 1
