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
fi

# Whether Deployment Protection, rather than the app, answered anything.
#
# This used to warn up front whenever the bypass secret was unset. Against the
# production alias — which is public and is what this now tests — that warning
# was on every green run, and a warning that fires when nothing is wrong is one
# people stop reading. It is raised at the end instead, only when a redirect to
# the SSO endpoint was actually seen.
protected=0

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
  case "$location" in *vercel.com/sso-api*) protected=1 ;; esac
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
# Takes the door it should be sent to, because there is more than one: the
# consoles send a stranger to /en/signin, and /admin/* has its own gate at
# /admin/login. Asserting the general one against the admin console failed a
# guard that was working correctly.
#
# Deliberately not fussy about *how*. `redirect()` in a layout sends a 307 when
# it is reached before anything streams, but Next falls back to a meta refresh
# in a 200 when it is not — an implementation detail that is none of this
# script's business. Either is a pass; serving the console is not.
check_signin() {
  local door="${2:-/en/signin}"
  fetch "$1"
  case "$status" in
    307 | 308)
      if [ "$location" != "$door" ]; then
        fail "$1" "redirected to ${location:-nothing}, expected $door"
      else
        pass "$1" "$status -> $door"
      fi
      ;;
    200)
      if grep -q "$door" "$body"; then
        pass "$1" "200, sent to sign in"
      else
        fail "$1" "answered 200 and did not send the visitor to $door"
      fi
      ;;
    *)
      fail "$1" "returned $status, expected to be sent to $door"
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
check_signin /admin/controls /admin/login

if [ "$protected" -ne 0 ]; then
  cat >&2 <<'EOF'
::error::Deployment Protection answered, not the site.

Something above was redirected to vercel.com/sso-api, so those checks never
reached the application and say nothing about whether it works.

Either point URL at the production alias, which is public — the PRODUCTION_URL
repository variable, read in ci.yml — or, to test a protected deployment URL,
generate a secret at Vercel > Project > Settings > Deployment Protection >
Protection Bypass for Automation and add it as the repository secret
VERCEL_AUTOMATION_BYPASS_SECRET.
EOF
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "::error::Smoke test failed — see the lines marked FAIL above."
  exit 1
fi

echo "All checks passed."
