#!/usr/bin/env bash
# Checks, before anything is built, that everything the TestFlight upload needs is set, and says in plain words
# what to add where. Used by .github/workflows/testflight.yml; see docs/ios-app.md, "Upload to TestFlight".
#
# Reads from the environment (the workflow passes them in; nothing is printed but whether each is set):
#   APP_BUNDLE_ID_VAR     repository variable APP_BUNDLE_ID (optional if AppIdentity.xcconfig already holds the real one)
#   APPLE_TEAM_ID         repository variable or secret APPLE_TEAM_ID
#   ASC_KEY_ID            secret APP_STORE_CONNECT_KEY_ID
#   ASC_ISSUER_ID         secret APP_STORE_CONNECT_ISSUER_ID
#   ASC_KEY_P8            secret APP_STORE_CONNECT_KEY (the whole text of the .p8 file)
#   IDENTITY_FILE         path to AppIdentity.xcconfig (default: next to this script's ios folder)
#
# On success it prints BUNDLE_ID=<the identifier to build with>, for the workflow to keep.
# Exits 1, with the list of what is missing, if anything is.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
identity="${IDENTITY_FILE:-$here/../ios/AppIdentity.xcconfig}"
settings="the repository on GitHub: Settings, then Secrets and variables, then Actions"

missing=()

# The bundle identifier: the repository variable wins; else the one committed in AppIdentity.xcconfig.
committed="$(sed -n 's/^[[:space:]]*APP_BUNDLE_ID[[:space:]]*=[[:space:]]*\([^[:space:]]*\).*/\1/p' "$identity" | head -n 1)"
bundle="${APP_BUNDLE_ID_VAR:-$committed}"
if [ -z "$bundle" ] || [[ "$bundle" == com.example.* ]]; then
  missing+=("Variable APP_BUNDLE_ID (Variables tab): the app's bundle identifier, exactly as in the app's record in App Store Connect, such as com.yourname.riddlebrook. The one in the repository is still the placeholder ${committed:-<none>}.")
elif ! [[ "$bundle" =~ ^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$ ]]; then
  missing+=("Variable APP_BUNDLE_ID: \"$bundle\" is not a bundle identifier. Use letters, digits, hyphens and dots, such as com.yourname.riddlebrook.")
fi

if [ -z "${APPLE_TEAM_ID:-}" ]; then
  missing+=("Variable APPLE_TEAM_ID (Variables tab, or as a secret): your Apple team ID, 10 letters and digits, shown on developer.apple.com under Account, Membership details.")
elif ! [[ "$APPLE_TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  missing+=("APPLE_TEAM_ID is set but is not 10 capital letters and digits. Copy the Team ID from Membership details again.")
fi

if [ -z "${ASC_KEY_ID:-}" ]; then
  missing+=("Secret APP_STORE_CONNECT_KEY_ID: the Key ID of your App Store Connect API key, shown beside the key under Users and Access, Integrations.")
elif ! [[ "$ASC_KEY_ID" =~ ^[A-Z0-9]{8,12}$ ]]; then
  missing+=("Secret APP_STORE_CONNECT_KEY_ID is set but does not look like a Key ID (about 10 capital letters and digits).")
fi

if [ -z "${ASC_ISSUER_ID:-}" ]; then
  missing+=("Secret APP_STORE_CONNECT_ISSUER_ID: the Issuer ID shown above the list of keys under Users and Access, Integrations.")
elif ! [[ "$ASC_ISSUER_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  missing+=("Secret APP_STORE_CONNECT_ISSUER_ID is set but is not an Issuer ID (it looks like 8-4-4-4-12 letters and digits).")
fi

if [ -z "${ASC_KEY_P8:-}" ]; then
  missing+=("Secret APP_STORE_CONNECT_KEY: the whole text of the AuthKey_....p8 file you downloaded, from the BEGIN line to the END line.")
elif ! grep -q -- "-----BEGIN PRIVATE KEY-----" <<<"$ASC_KEY_P8" || ! grep -q -- "-----END PRIVATE KEY-----" <<<"$ASC_KEY_P8"; then
  missing+=("Secret APP_STORE_CONNECT_KEY is set but is not the whole .p8 file. Paste all of it, the BEGIN and END lines included.")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  {
    echo "NOT READY TO UPLOAD TO TESTFLIGHT. Add these in $settings:"
    for m in "${missing[@]}"; do echo "  - $m"; done
    echo "Then run the workflow again. Nothing was built or sent to Apple."
  } >&2
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Not ready to upload to TestFlight"
      echo "Add these in $settings, then run the workflow again:"
      for m in "${missing[@]}"; do echo "- $m"; done
    } >>"$GITHUB_STEP_SUMMARY"
  fi
  for m in "${missing[@]}"; do echo "::error title=Missing for TestFlight::$m"; done
  exit 1
fi

echo "Everything the upload needs is set. Bundle identifier: $bundle"
echo "BUNDLE_ID=$bundle"
