#!/bin/bash
# TEST ONLY (branch progress-backup-mac-test). One simulator: plays levels 1 and 2 in the built app and
# turns both settings, ends the app, deletes the web view's localStorage files (what iOS may do when the
# device is low on space), starts it again and reads what came back. Then Reset progress, the same wipe,
# and one more start: the stars must stay gone. Between lives it prints the app's UserDefaults.
#   ios-wipe.sh <label> <device name> <orientation LANDSCAPE|PORTRAIT|-> "<flags>"
set -u
LABEL="$1"; NAME="$2"; ORIENT="$3"; FLAGS="${4:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')
say() { echo "$(date -u +%H:%M:%S) [shell] $*" | tee -a "$OUT/run-log.txt"; }

UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(x['udid']); sys.exit()")
if [ -z "$UDID" ]; then
  TYPE=$(xcrun simctl list devicetypes -j | python3 -c "import json,sys; print([t['identifier'] for t in json.load(sys.stdin)['devicetypes'] if t['name']=='$NAME'][0])")
  for RT in $(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['isAvailable'] and x['platform']=='iOS']; print(' '.join(x['identifier'] for x in sorted(r,key=lambda x:[int(n) for n in x['version'].split('.')], reverse=True)))"); do
    UDID=$(xcrun simctl create "$NAME" "$TYPE" "$RT") && break
  done
fi
[ -z "$UDID" ] && { say "no simulator for $NAME"; exit 1; }
say "device $NAME: $UDID"
xcrun simctl list devices | grep "$UDID" | tee -a "$OUT/device.txt"
xcrun simctl list runtimes | tee -a "$OUT/device.txt"
T0=$(date +%s)
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
say "booted in $(( $(date +%s) - T0 )) s"
xcrun simctl install "$UDID" "$APP"
say "app installed (fresh: this simulator never had it)"
"$ROOT/e2e/app/watch-usage.sh" "$OUT" "$UDID" "$BUNDLE" &
USEPID=$!

export APPIUM_HOME="$ROOT/e2e/app/.appium"
"$ROOT/e2e/app/node_modules/.bin/appium" --address 127.0.0.1 --port 4723 --log-timestamp --log-no-colors --log "$OUT/appium.txt" --log-level info:debug > /dev/null 2>&1 &
APPIUMPID=$!
for i in $(seq 1 60); do curl -sf http://127.0.0.1:4723/status > /dev/null && break; sleep 2; done

CAPS=$(python3 -c "
import json
print(json.dumps({
 'platformName':'iOS','appium:automationName':'XCUITest','appium:udid':'$UDID','appium:bundleId':'$BUNDLE',
 'appium:noReset':True,'appium:newCommandTimeout':3600,'appium:wdaLaunchTimeout':1800000,'appium:wdaConnectionTimeout':1800000,
 'appium:webviewConnectTimeout':120000,'appium:includeSafariInWebviews':False,'appium:autoWebview':False,
 'appium:nativeWebScreenshot':True,'appium:showXcodeLog':False,'appium:waitForIdleTimeout':0,'appium:skipLogCapture':True,
 'appium:webviewConnectRetries':20,'appium:additionalWebviewBundleIds':['*'],'appium:forceAppLaunch':True,'appium:shouldTerminateApp':False
}))")
EXTRA=()
for F in $FLAGS; do case "$F" in *=*) EXTRA+=("--${F%%=*}" "${F#*=}");; *) EXTRA+=("--$F");; esac; done

# One life of the app: <name> <phase> [more arguments]
life() {
  local N="$1" P="$2"; shift 2
  say "=== $N: starting the app (phase $P)"
  local A=(--backend appium --phase "$P" --name "$N" --device "$LABEL" --out "$OUT" --caps "$CAPS" --bundle-id "$BUNDLE" --udid "$UDID")
  [ "$ORIENT" != "-" ] && A+=(--orientation "$ORIENT")
  "$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/quit.ts" "${A[@]}" "${EXTRA[@]}" "$@"
  local S=$?
  say "=== $N: ended with status $S"
  return $S
}
# How many processes of the app are alive in the simulator?
alive() { xcrun simctl spawn "$UDID" launchctl list 2> /dev/null | grep -c "$BUNDLE"; }
# Ends the app fully, as a swipe up in the app switcher does, and says whether a process is left.
quit_app() {
  say "app processes before the quit: $(alive)"
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>&1 | tee -a "$OUT/run-log.txt"
  sleep 3
  say "app processes after the quit: $(alive); on the Mac: $(pgrep -f "/App.app/App" | wc -l | tr -d ' ')"
}
# What the app's own folder holds (names and sizes), and the saved entries read from the web view's own database file.
store() {
  local D; D=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2> /dev/null)
  {
    echo "== $(date -u +%H:%M:%S) $1"
    echo "folder: $D"
    ( cd "$D" 2> /dev/null && find . -type f 2> /dev/null | grep -v "Caches/com.apple" | while read -r f; do echo "$(stat -f %z "$f") $f"; done )
    ( cd "$D" 2> /dev/null && find . -name 'localstorage.sqlite3' | while read -r f; do echo "-- entries in $f"; sqlite3 "file:$f?mode=ro" "select cast(key as text), length(value), hex(value) from ItemTable" 2>&1; done )
  } >> "$OUT/app-folder.txt"
}

# The app's own settings store (UserDefaults), read through the simulator's preferences daemon.
prefs() {
  { echo "== $(date -u +%H:%M:%S) UserDefaults of $BUNDLE: $1"; xcrun simctl spawn "$UDID" defaults read "$BUNDLE" 2>&1 | grep -i -A1 "CapacitorStorage" || echo "(no CapacitorStorage entries)"; } | tee -a "$OUT/userdefaults.txt"
}
# What iOS may do under low space: the web view's localStorage for the app is gone. The app is not running.
wipe() {
  local D; D=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data 2> /dev/null)
  say "app processes before the wipe: $(alive)"
  ( cd "$D" && find . -type d -name LocalStorage -path '*WebKit*' ) | tee -a "$OUT/run-log.txt" | while read -r L; do rm -rf "$D/$L"; done
  say "localstorage files left after the wipe: $( (cd "$D" && find . -name 'localstorage.sqlite3*') | wc -l | tr -d ' ')"
}

FAIL=0
life 1-play play || FAIL=1
quit_app
store "after play and a quit"
prefs "after play"
wipe
store "after the wipe, before the next start"
life 2-after-wipe check --expect 1-play.json --locked 4 || FAIL=1
quit_app
store "after the start that followed the wipe"
prefs "after the start that followed the wipe"

life 3-reset reset || FAIL=1
quit_app
store "after reset and quit"
prefs "after reset"
wipe
life 4-after-reset-and-wipe check --expect 3-reset.json --expect-progress-line "No stars yet." --locked 2 || FAIL=1
quit_app
store "after the last start"
prefs "after the last start"

kill $APPIUMPID $USEPID 2> /dev/null
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
mkdir -p "$OUT/small"
for f in "$OUT"/shots/*.png; do sips -s format jpeg -s formatOptions 70 -Z 1400 "$f" --out "$OUT/small/$(basename "${f%.png}").jpg" > /dev/null 2>&1; done
gzip -f "$OUT/appium.txt" 2> /dev/null
exit $FAIL
