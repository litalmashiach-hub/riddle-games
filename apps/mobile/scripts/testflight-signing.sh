#!/usr/bin/env bash
# Signing for the TestFlight upload, on a hosted Mac. Used by .github/workflows/testflight.yml; see docs/ios-app.md,
# "Upload to TestFlight".
#
# The app is signed by hand ("manual signing") with the owner's Apple Distribution certificate and App Store
# provisioning profile, which the owner made once and added as secrets. This is GitHub's documented way to sign on
# its Macs ("Installing an Apple certificate on macOS runners for Xcode development"). Nothing is created in the
# owner's Apple account by a run, so every run on a new Mac signs the same way.
#
#   keychain            make a keychain that lives only for this run, and put it first in the search list
#   import-certificate  import the .p12 (CERT_P12_B64, CERT_PASSWORD) into it; prints SIGN_SHA1 and SIGN_IDENTITY
#   install-profile     check the profile (PROFILE_B64) against the team, the bundle identifier and the certificate,
#                       and install it; prints PROFILE_UUID and PROFILE_NAME
#   set-project         set manual signing on the app's own target only, in this runner's copy of the project
#   cleanup             delete the keychain, the profile and the key files
#
# Values it prints are for $GITHUB_ENV: hashes, the identity's kind, the profile's UUID and name. It never prints a
# certificate, a key or a password.
set -euo pipefail

die() { echo "::error title=Signing::$*"; echo "Stopped: $*" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
tmp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
keychain="${KEYCHAIN:-$tmp/testflight.keychain-db}"
profiles_dirs=("$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles")

# Secrets pasted into GitHub's box may carry line breaks or spaces; base64 ignores neither on every system.
decode() { tr -d ' \t\r\n' | base64 --decode; }

case "${1:-}" in
  keychain)
    password="$(openssl rand -hex 24)"
    security create-keychain -p "$password" "$keychain"
    security set-keychain-settings -lut 21600 "$keychain"
    security unlock-keychain -p "$password" "$keychain"
    # shellcheck disable=SC2046
    security list-keychains -d user -s "$keychain" $(security list-keychains -d user | tr -d '"')
    echo "KEYCHAIN=$keychain"
    echo "KEYCHAIN_PASSWORD=$password"
    ;;

  import-certificate)
    : "${CERT_P12_B64:?}" "${CERT_PASSWORD:?}" "${KEYCHAIN_PASSWORD:?}"
    p12="$tmp/distribution.p12"
    (umask 077; printf '%s' "$CERT_P12_B64" | decode >"$p12") \
      || die "Secret APPLE_DISTRIBUTION_CERTIFICATE is not base64 text. Paste the whole of APPLE_DISTRIBUTION_CERTIFICATE.txt again."
    if ! security import "$p12" -k "$keychain" -P "$CERT_PASSWORD" -f pkcs12 -T /usr/bin/codesign -T /usr/bin/security >/dev/null; then
      rm -f "$p12"
      die "The certificate would not import: most often the password does not belong to it. Paste APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD.txt again, from the same run of make-signing-files.sh."
    fi
    rm -f "$p12"
    # Lets codesign use the key without a prompt, which a hosted Mac cannot answer.
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$keychain" >/dev/null
    line="$(security find-identity -p codesigning "$keychain" | grep -E '^ *[0-9]+\) [0-9A-F]{40} ' | head -n 1 || true)"
    [ -n "$line" ] || die "The certificate imported, but holds no signing identity (its private key is missing). Make the files again with make-signing-files.sh."
    sha1="$(sed -E 's/^ *[0-9]+\) ([0-9A-F]{40}) .*/\1/' <<<"$line")"
    name="$(sed -E 's/^[^"]*"([^"]*)".*/\1/' <<<"$line")"
    kind="${name%%:*}"
    count="$(security find-identity -p codesigning "$keychain" | grep -cE '^ *[0-9]+\) [0-9A-F]{40} ' || true)"
    [ "$count" -le 1 ] || echo "::warning::The keychain holds $count signing identities; signing uses the first, $sha1."
    if [ "${REHEARSAL:-}" != "1" ]; then
      case "$kind" in
        "Apple Distribution"|"iPhone Distribution") ;;
        *) die "The certificate is \"$kind\", not Apple Distribution. Make an Apple Distribution certificate (make-signing-files.sh, step 8 of the launch steps)." ;;
      esac
      if ! security find-identity -v -p codesigning "$keychain" | grep -q "$sha1"; then
        die "The certificate is not valid now: expired, revoked, or not issued by Apple. Make a new one (step 8 of the launch steps)."
      fi
    fi
    echo "Imported signing identity: $kind, SHA-1 $sha1" >&2
    echo "SIGN_SHA1=$sha1"
    echo "SIGN_IDENTITY=$kind"
    ;;

  install-profile)
    : "${PROFILE_B64:?}" "${TEAM_ID:?}" "${BUNDLE_ID:?}" "${SIGN_SHA1:?}"
    raw="$tmp/appstore.mobileprovision"
    plist="$tmp/appstore-profile.plist"
    printf '%s' "$PROFILE_B64" | decode >"$raw" \
      || die "Secret APPSTORE_PROVISIONING_PROFILE is not base64 text. Paste the whole of APPSTORE_PROVISIONING_PROFILE.txt again."
    security cms -D -i "$raw" >"$plist" 2>/dev/null \
      || die "Secret APPSTORE_PROVISIONING_PROFILE is not a provisioning profile. Paste the whole of APPSTORE_PROVISIONING_PROFILE.txt again."
    # Python's plist reader checks it: prints UUID, name, expiry, and a reason to refuse it, if any.
    checked="$(TEAM_ID="$TEAM_ID" BUNDLE_ID="$BUNDLE_ID" SIGN_SHA1="$SIGN_SHA1" python3 -I "$here/testflight-profile-check.py" "$plist")" \
      || die "Could not read the provisioning profile."
    uuid="$(sed -n 1p <<<"$checked")"; name="$(sed -n 2p <<<"$checked")"
    expires="$(sed -n 3p <<<"$checked")"; why="$(sed -n 4p <<<"$checked")"
    [ -z "$why" ] || die "$why"
    for d in "${profiles_dirs[@]}"; do mkdir -p "$d"; cp "$raw" "$d/$uuid.mobileprovision"; done
    rm -f "$raw" "$plist"
    echo "Installed App Store profile \"$name\" ($uuid), expires $expires" >&2
    echo "PROFILE_UUID=$uuid"
    echo "PROFILE_NAME=$name"
    ;;

  set-project)
    : "${PBXPROJ:?}" "${TEAM_ID:?}" "${SIGN_IDENTITY:?}" "${PROFILE_UUID:?}"
    # Only the app's own Release configuration is changed: a setting given on xcodebuild's command line would reach
    # the Swift package targets too, and Xcode refuses a profile there. Nothing is committed.
    TEAM_ID="$TEAM_ID" SIGN_IDENTITY="$SIGN_IDENTITY" PROFILE_UUID="$PROFILE_UUID" perl -0pi -e '
      my $n = 0;
      s{(\t\t[0-9A-F]{24} /\* Release \*/ = \{\n\t\t\tisa = XCBuildConfiguration;\n.*?\n\t\t\};\n)}{
        my $b = $1;
        if ($b =~ /PRODUCT_BUNDLE_IDENTIFIER = "\$\(APP_BUNDLE_ID\)";/) {
          $n++;
          $b =~ s/\t\t\t\tCODE_SIGN_STYLE = Automatic;\n/\t\t\t\tCODE_SIGN_STYLE = Manual;\n\t\t\t\tDEVELOPMENT_TEAM = $ENV{TEAM_ID};\n\t\t\t\tCODE_SIGN_IDENTITY = "$ENV{SIGN_IDENTITY}";\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "$ENV{PROFILE_UUID}";\n/ or $n += 100;
        }
        $b
      }gse;
      die "expected one app Release configuration with CODE_SIGN_STYLE = Automatic, found $n\n" unless $n == 1;
    ' "$PBXPROJ" || die "Could not set manual signing in the project; the app target's Release settings have changed shape."
    echo "Manual signing set on the app target's Release configuration." >&2
    ;;

  cleanup)
    security delete-keychain "$keychain" 2>/dev/null || true
    if [ -n "${PROFILE_UUID:-}" ]; then
      for d in "${profiles_dirs[@]}"; do rm -f "$d/$PROFILE_UUID.mobileprovision"; done
    fi
    rm -rf "$tmp/private_keys" "$tmp/distribution.p12" "$tmp/appstore.mobileprovision" "$tmp/appstore-profile.plist"
    ;;

  *)
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
