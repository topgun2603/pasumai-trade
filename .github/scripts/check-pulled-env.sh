#!/usr/bin/env bash
#
# Fails the deploy when a NEXT_PUBLIC_* variable did not survive `vercel pull`.
#
# This deploy pulls the environment, builds locally and uploads the result with
# `--prebuilt`. `NEXT_PUBLIC_*` values are inlined into the client bundle during
# that build, so what `vercel pull` wrote is what ships forever.
#
# A variable marked **Sensitive** in the Vercel dashboard cannot be read back —
# `vercel pull` writes the literal string `[SENSITIVE]` where its value should
# be. The build then bakes that placeholder into the bundle, the deploy
# succeeds, and the application is broken in a way nothing reports: Firebase
# initialised with `apiKey: "[SENSITIVE]"` and every sign-in failed against
# identitytoolkit with `key=%5BSENSITIVE%5D`, for every account, by email and by
# mobile alike.
#
# Server-side variables are unaffected — they are read at runtime from Vercel's
# own environment rather than from this file — which is why the API kept working
# and made the fault look like anything but a configuration problem.
#
# Reads only whether each value is a placeholder. Nothing here echoes a value.
set -euo pipefail

env_file="${1:?usage: check-pulled-env.sh <path to pulled env file>}"

if [ ! -f "$env_file" ]; then
  echo "::error::$env_file does not exist — did 'vercel pull' run?"
  exit 1
fi

# Only the public ones. A sensitive server-side variable is correctly sensitive
# and correctly unreadable here; it reaches the deployment at runtime.
bad=()
while IFS= read -r line; do
  case "$line" in NEXT_PUBLIC_*) ;; *) continue ;; esac
  name="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  case "$value" in
    "[SENSITIVE]" | "" ) bad+=("$name") ;;
  esac
done < "$env_file"

if [ ${#bad[@]} -eq 0 ]; then
  echo "Every NEXT_PUBLIC_* variable pulled with a real value."
  exit 0
fi

echo "::error::These NEXT_PUBLIC_* variables pulled as placeholders and would ship broken: ${bad[*]}"

cat >&2 <<EOF

'vercel pull' returned "[SENSITIVE]" for the variables above, which means they
are marked **Sensitive** in the Vercel dashboard. Sensitive values cannot be
read back, and this deploy inlines NEXT_PUBLIC_* values at build time — so the
placeholder, not the value, would be compiled into the client bundle.

To fix, in Vercel > Settings > Environment Variables, for each variable listed:

  1. Delete it. (The Sensitive flag cannot be removed from an existing
     variable; it has to be recreated.)
  2. Add it again with the same name and value, leaving Sensitive unticked.
  3. Re-run this workflow.

Marking these Sensitive protects nothing. A NEXT_PUBLIC_* value is compiled
into JavaScript that is served to every visitor — it is public by definition,
which is what the prefix means. Firebase documents its web API key as an
identifier rather than a credential; the security boundary is Firestore
Security Rules and App Check.

Genuine secrets — FIREBASE_SERVICE_ACCOUNT_KEY, CRON_SECRET, Razorpay keys —
should stay Sensitive. They are read at runtime and never pass through this
file, so they are unaffected by this check.
EOF

exit 1
