#!/bin/bash
# TEST ONLY (branch test/reviewer-session-mac-test). One simulator, freshly made: the app installed new,
# a cold first launch filmed by the simulator's own screenshots, then one session as App Review would
# have it (e2e/app/reviewer.ts).
#   ios-reviewer.sh <label> <device name> <orientation LANDSCAPE|-> "<flags>"
set -u
LABEL="$1"; NAME="$2"; ORIENT="$3"; FLAGS="${4:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT/shots"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')
say() { echo "$(date -u +%H:%M:%S) [shell] $*" | tee -a "$OUT/run-log.txt"; }

TYPE=$(xcrun simctl list devicetypes -j | python3 -c "import json,sys; print([t['identifier'] for t in json.load(sys.stdin)['devicetypes'] if t['name']=='$NAME'][0])")
RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['isAvailable'] and x['platform']=='iOS']; print(sorted(r,key=lambda x:[int(n) for n in x['version'].split('.')])[-1]['identifier'])")
UDID=$(xcrun simctl create "review-$LABEL" "$TYPE" "$RT")
[ -z "$UDID" ] && { say "no simulator for $NAME"; exit 1; }
say "device $NAME ($TYPE) on $RT: $UDID (made new for this run)"
xcrun simctl list devices | grep "$UDID" | tee -a "$OUT/device.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
say "booted"
[ "$ORIENT" = "LANDSCAPE" ] && say "(the device is turned by the test driver once the session starts)"
xcrun simctl install "$UDID" "$APP"
say "app installed fresh"
plutil -p "$APP/Info.plist" > "$OUT/info-plist.txt" 2>&1
"$ROOT/e2e/app/watch-usage.sh" "$OUT" "$UDID" "$BUNDLE" &
USEPID=$!

# The first launch, cold, filmed: the launch screen, the hand-over, the first frame of the map.
T0=$(python3 -c 'import time; print(time.time())')
xcrun simctl launch "$UDID" "$BUNDLE" | tee -a "$OUT/run-log.txt"
for t in 0.3 0.8 1.5 2.5 4 6 9 14 20; do
  python3 -c "import time; t0=$T0; time.sleep(max(0, t0+$t-time.time()))"
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/shots/$LABEL-00-cold-launch-at-${t}s.png" > /dev/null 2>&1
done
say "cold launch filmed"
xcrun simctl terminate "$UDID" "$BUNDLE"
sleep 2

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
A=(--device "$LABEL" --out "$OUT" --caps "$CAPS" --bundle-id "$BUNDLE")
[ "$ORIENT" != "-" ] && A+=(--orientation "$ORIENT")
"$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/reviewer.ts" "${A[@]}" "${EXTRA[@]}"
S=$?
say "session ended with status $S"
say "app state: $(xcrun simctl spawn "$UDID" launchctl list 2> /dev/null | grep -c "$BUNDLE") process(es)"

kill $APPIUMPID $USEPID 2> /dev/null
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' -o -name 'JetsamEvent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
xcrun simctl spawn "$UDID" log show --last 3h --style compact --predicate '(process == "App" OR process CONTAINS "WebContent") AND (messageType == fault OR eventMessage CONTAINS[c] "crash" OR eventMessage CONTAINS[c] "jetsam" OR eventMessage CONTAINS[c] "terminated")' > "$OUT/device-log-faults.txt" 2>&1 || true
wc -l "$OUT/device-log-faults.txt" | tee -a "$OUT/run-log.txt"
mkdir -p "$OUT/small"
for f in "$OUT"/shots/*.png; do sips -s format jpeg -s formatOptions 72 -Z 1400 "$f" --out "$OUT/small/$(basename "${f%.png}").jpg" > /dev/null 2>&1; done
gzip -f "$OUT/appium.txt" 2> /dev/null
exit $S
