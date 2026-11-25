#!/usr/bin/env bash
# Makes the app's App Store signing files without a Mac, for the TestFlight upload workflow.
# The owner runs it once, on any computer with a terminal and openssl: Windows with Git for Windows ("Git Bash"),
# Linux, or a GitHub codespace on this repository. See docs/launch-steps.md, step 8.
#
#   1. make-signing-files.sh request
#        Makes a private key and a certificate signing request (CSR) in a folder apple-signing, in the folder
#        you run it from (or in $SIGNING_DIR). This repository ignores that folder, so it is never committed.
#        Upload the CSR on developer.apple.com: Certificates, plus, Apple Distribution. Download the .cer file.
#   2. Make the App Store provisioning profile on developer.apple.com (Profiles, plus, App Store Connect) for the
#      app's identifier and the certificate from step 1, and download the .mobileprovision file.
#   3. make-signing-files.sh finish <the .cer file> <the .mobileprovision file>
#        Checks that the certificate belongs to the key, and that the profile is an App Store profile that holds
#        this certificate. Then writes three small text files, one per GitHub secret, to paste into the
#        repository's settings, and says which is which.
#
# Nothing leaves the computer: the script sends nothing anywhere, and prints no key and no password.
# The key and the files stay in the folder until the owner deletes it. Keep the key (or the .p12) in a safe place
# of your own, such as a password manager: with it, a new profile can be made later without a new certificate.
set -euo pipefail

# Git Bash on Windows would otherwise turn "/CN=..." into a Windows path.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

dir="${SIGNING_DIR:-$PWD/apple-signing}"
key="$dir/distribution.key"
csr="$dir/distribution.csr"

die() { echo "Stopped: $*" >&2; exit 1; }
command -v openssl >/dev/null || die "openssl is not installed here. Git Bash on Windows, Linux and GitHub codespaces have it."

b64() { openssl base64 -A -in "$1"; }

case "${1:-}" in
  request)
    mkdir -p "$dir"
    chmod 700 "$dir"
    if [ -e "$key" ]; then
      die "$key already exists. If you made a request before and never used it, delete the folder $dir and run this again. If Apple already issued a certificate for it, go on with: $0 finish <the .cer file> <the .mobileprovision file>"
    fi
    (umask 077; openssl genrsa -out "$key" 2048 2>/dev/null)
    # Apple ignores the name in the request and writes its own into the certificate.
    openssl req -new -key "$key" -out "$csr" -subj "/CN=App Store distribution/O=Riddle Games/C=US"
    openssl req -in "$csr" -noout -verify >/dev/null 2>&1 || die "the request that was just made does not check out."
    echo "Made a private key and a certificate signing request in $dir:"
    echo "  distribution.key  the private key: keep it, give it to no one, never paste it anywhere"
    echo "  distribution.csr  the request: upload this one to Apple"
    echo
    echo "Next: on developer.apple.com, Account, Certificates, press the plus, choose Apple Distribution, Continue,"
    echo "choose the file distribution.csr, Continue, then Download. Then make the App Store profile and run:"
    echo "  $0 finish <the downloaded .cer file> <the downloaded .mobileprovision file>"
    ;;

  finish)
    cer="${2:-}"; profile="${3:-}"
    [ -f "$key" ] || die "there is no private key in $dir. Run '$0 request' first (or set SIGNING_DIR to the folder that holds distribution.key)."
    [ -n "$cer" ] && [ -f "$cer" ] || die "give the downloaded certificate file (.cer) as the first file."
    # The rehearsal in the workflow's check mode has no Apple profile; everyone else needs one.
    if [ -z "$profile" ] && [ "${REHEARSAL:-}" != "1" ]; then
      die "give the downloaded provisioning profile (.mobileprovision) as the second file."
    fi
    [ -z "$profile" ] || [ -f "$profile" ] || die "there is no file $profile."

    work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
    # Apple's .cer is binary (DER); accept a PEM one too.
    if ! openssl x509 -inform DER -in "$cer" -out "$work/cert.pem" 2>/dev/null; then
      openssl x509 -in "$cer" -out "$work/cert.pem" 2>/dev/null || die "$cer is not a certificate file."
    fi
    subject="$(openssl x509 -in "$work/cert.pem" -noout -subject)"
    key_pub="$(openssl pkey -in "$key" -pubout | openssl sha256)"
    cert_pub="$(openssl x509 -in "$work/cert.pem" -noout -pubkey | openssl sha256)"
    [ "$key_pub" = "$cert_pub" ] || die "this certificate was not made from the request in $dir. Download the certificate that you made from distribution.csr, or start again with a new request."
    if [ "${REHEARSAL:-}" != "1" ] && ! grep -qE "(Apple|iPhone) Distribution" <<<"$subject"; then
      die "this is not a distribution certificate ($subject). On Apple's page choose Apple Distribution, not Apple Development."
    fi
    if ! openssl x509 -in "$work/cert.pem" -noout -checkend 86400 >/dev/null; then
      die "this certificate has expired or expires within a day. Make a new one."
    fi

    if [ -n "$profile" ]; then
      openssl smime -verify -noverify -inform DER -in "$profile" -out "$work/profile.plist" 2>/dev/null \
        || openssl cms -verify -noverify -inform DER -in "$profile" -out "$work/profile.plist" 2>/dev/null \
        || die "$profile is not a provisioning profile."
      grep -q "<key>ProvisionedDevices</key>" "$work/profile.plist" \
        && die "this is a development or ad hoc profile (it lists devices). Make the profile under Distribution, App Store Connect."
      grep -q "<key>ProvisionsAllDevices</key>" "$work/profile.plist" \
        && die "this is an enterprise profile. Make the profile under Distribution, App Store Connect."
      # The profile carries the certificates it accepts, as base64 of their binary form.
      cert_b64="$(openssl x509 -in "$work/cert.pem" -outform DER | openssl base64 -A)"
      tr -d ' \t\r\n' <"$work/profile.plist" | grep -qF "$cert_b64" \
        || die "this profile was made for another certificate. Edit the profile on Apple's page, tick the certificate you just made, save and download it again."
    fi

    password="$(openssl rand -hex 24)"
    p12="$dir/distribution.p12"
    # The older PBE-SHA1-3DES protection, because macOS's keychain may not read OpenSSL 3's default.
    PASS="$password" openssl pkcs12 -export -inkey "$key" -in "$work/cert.pem" -name "App Store distribution" \
      -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 -passout env:PASS -out "$p12"
    PASS="$password" openssl pkcs12 -in "$p12" -passin env:PASS -noout 2>/dev/null || die "the .p12 file that was just made does not open."

    (umask 077
      b64 "$p12" >"$dir/APPLE_DISTRIBUTION_CERTIFICATE.txt"
      printf '%s' "$password" >"$dir/APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD.txt"
      if [ -n "$profile" ]; then b64 "$profile" >"$dir/APPSTORE_PROVISIONING_PROFILE.txt"; fi)

    echo "The certificate belongs to your key${profile:+, and the profile is an App Store profile that holds it}."
    echo "Made in $dir, one file per GitHub secret. Open each in a text editor, copy all of it, and paste it as the"
    echo "secret of the same name (Settings, Secrets and variables, Actions, Secrets, New repository secret):"
    echo "  APPLE_DISTRIBUTION_CERTIFICATE.txt           -> secret APPLE_DISTRIBUTION_CERTIFICATE"
    echo "  APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD.txt  -> secret APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD"
    if [ -n "$profile" ]; then
      echo "  APPSTORE_PROVISIONING_PROFILE.txt            -> secret APPSTORE_PROVISIONING_PROFILE"
    fi
    echo "Then keep distribution.p12 and the password file in a safe place of your own, and delete this folder."
    ;;

  *)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
