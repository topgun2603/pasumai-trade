#!/usr/bin/env bash
#
# Checks a freshly deployed URL by asking it for a handful of pages and
# comparing what comes back against what the routing is supposed to do.
#
# Two things this has to get right, both learned the hard way:
#
#   1. Deployment Protection answers first. Every generated deployment URL is
#      behind Vercel Authentication, so an unauthenticated curl never reaches
#      the app at all — it gets a 302 to vercel.com/sso-api and the smoke test
#      fails complaining about a page it never actually loaded. The automation
#      bypass header is the supported way past it, and it keeps protection on
#      for everyone else.
#
#   2. Not every route answers 200, and the ones that don't are the point.
#      `/` redirects to a language, `/market` is withdrawn, and a console asks
#      a stranger to sign in. A blanket "everything must be 200" cannot express
#      any of that, so each path carries the answer it is supposed to give.
#
# Reads only status lines, Location headers and — for the console routes —
# whether the body names the sign-in page. Nothing here echoes the secret.
set -euo pipefail

url="${URL:?URL is not set — pass the deployed URL in the environment}"
url="${url%/}"

curl_args=(--silent --show-error --max-time 30)

if [ -n "${BYPASS_SECRET:-}" ]; then
  curl_args+=(--header "x-vercel-protection-bypass: ${BYPASS_SECRET}")
else
  cat >&2 <<'EOF'
::warning::VERCEL_AUTOMATION_BYPASS_SECRET is not set.

If Deployment Protection is on for this project, every request below will be
answered by Vercel's sign-in redirect rather than by the site, and every check
will fail with a 302 to vercel.com/sso-api.

To fix: Vercel > Project > Settings > Deployment Protection >
Protection Bypass for Automation > generate the secret, then add it as the
repository secret VERCEL_AUTOMATION_BYPASS_SECRET.
EOF
fi

failed=0
body="$(mktemp)"
headers="$(mktemp)"
trap 'rm -f "$body" "$headers"' EXIT

# Fetches one path without following redirects, leaving the response in $status,
# $location and $body. Redirects are deliberately not followed: a 307 to the
# sign-in page is the guard doing its job, and a smoke test that quietly
# followed it would go green on the day the console started answering 200 to a
# stranger.
status=""
location=""
fetch() {
  curl "${curl_args[@]}" --dump-header "$headers" --output "$body" "${url}$1"
  status="$(awk 'toupper($1) ~ /^HTTP/ { code = $2 } END { print code }' "$headers")"
  location="$(awk 'tolower($1) == "location:" { print $2 }' "$headers" |
    tr -d '\r' | tail -n 1)"
  location="${location#"$url"}"
}

fail() {
  printf '  FAIL  %-18s %s\n' "$1" "$2"
  echo "::error::$1 — $2"
  failed=1
}

pass() { printf '  ok    %-18s %s\n' "$1" "$2"; }

# A page that must render for real.
check() {
  fetch "$1"
  if [ "$status" != "$2" ]; then
    fail "$1" "returned $status, expected $2"
  else
    pass "$1" "$status"
  fi
}

# A redirect the routing is supposed to make, asserted with its destination —
# the status alone would not catch a redirect that started pointing somewhere
# else.
check_redirect() {
  fetch "$1"
  if [ "$status" != "307" ]; then
    fail "$1" "returned $status, expected a 307 to $2"
  elif [ "$location" != "$2" ]; then
    fail "$1" "redirected to ${location:-nothing}, expected $2"
  else
    pass "$1" "$status -> $2"
  fi
}

# A console route, which must turn a stranger away.
#
# Deliberately not fussy about *how*. `redirect()` in a layout sends a 307 when
# it is reached before anything streams, but Next falls back to a meta refresh
# in a 200 when it is not — an implementation detail that is none of this
# script's business. Either is a pass; serving the console is not.
check_signin() {
  fetch "$1"
  case "$status" in
    307 | 308)
      if [ "$location" != "/en/signin" ]; then
        fail "$1" "redirected to ${location:-nothing}, expected /en/signin"
      else
        pass "$1" "$status -> /en/signin"
      fi
      ;;
    200)
      if grep -q '/en/signin' "$body"; then
        pass "$1" "200, sent to sign in"
      else
        fail "$1" "answered 200 and did not send the visitor to sign in"
      fi
      ;;
    *)
      fail "$1" "returned $status, expected to be sent to sign in"
      ;;
  esac
}

echo "Smoke testing ${url}"

# The public site renders.
check /en          200
check /ta          200
check /en/pricing  200
check /en/signin   200

# A bare root picks a language. curl sends no cookie and no Accept-Language, so
# it lands on the default.
check_redirect /       /en

# The market is withdrawn until the pipeline that fills it exists.
check_redirect /market /listings

# And the consoles are shut to someone who has not signed in. If either of these
# ever serves its page, the deploy is showing farmer data to the internet.
check_signin /listings
check_signin /admin/controls

if [ "$failed" -ne 0 ]; then
  echo "::error::Smoke test failed — see the lines marked FAIL above."
  exit 1
fi

echo "All checks passed."
