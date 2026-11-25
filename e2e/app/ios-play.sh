#!/bin/bash
# TEST ONLY. Boots one simulator, installs the built app, starts Appium and plays the levels.
#   ios-play.sh <label> <device name> <orientation PORTRAIT|LANDSCAPE|-> <levels a-b> <extras 0|1>
set -u
LABEL="$1"; NAME="$2"; ORIENT="$3"; LEVELS="$4"; EXTRAS="$5"; FLAGS="${6:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')

# The device: an existing one by its name, else made from its type on the newest iOS runtime.
UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(x['udid']); sys.exit()")
if [ -z "$UDID" ]; then
  TYPE=$(xcrun simctl list devicetypes -j | python3 -c "import json,sys; print([t['identifier'] for t in json.load(sys.stdin)['devicetypes'] if t['name']=='$NAME'][0])")
  # Newest iOS runtime that takes this device.
  for RT in $(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['isAvailable'] and x['platform']=='iOS']; print(' '.join(x['identifier'] for x in sorted(r,key=lambda x:[int(n) for n in x['version'].split('.')], reverse=True)))"); do
    echo "making $NAME ($TYPE) on $RT"
    UDID=$(xcrun simctl create "$NAME" "$TYPE" "$RT") && break
  done
fi
[ -z "$UDID" ] && { echo "no simulator for $NAME"; exit 1; }
echo "device $NAME: $UDID" | tee "$OUT/device.txt"
xcrun simctl list devices | grep "$UDID" | tee -a "$OUT/device.txt"
T0=$(date +%s)
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
echo "booted in $(( $(date +%s) - T0 )) s" | tee -a "$OUT/device.txt"
xcrun simctl install "$UDID" "$APP"
xcrun simctl spawn "$UDID" log stream --style compact --predicate 'process == "App" OR process CONTAINS "WebContent" OR process CONTAINS "GPU"' > "$OUT/unified.txt" 2>&1 &
LOGPID=$!
"$ROOT/e2e/app/watch-usage.sh" "$OUT" "$UDID" "$BUNDLE" &
USEPID=$!
"$ROOT/e2e/app/checkpoint.sh" "$OUT" "$LABEL" &
CKPID=$!

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
 'appium:webviewConnectRetries':20,'appium:additionalWebviewBundleIds':['*'],'appium:forceAppLaunch':True
}))")
ARGS=(--backend appium --device "$LABEL" --levels "$LEVELS" --out "$OUT" --caps "$CAPS" --bundle-id "$BUNDLE" --level-minutes 30)
[ "$ORIENT" != "-" ] && ARGS+=(--orientation "$ORIENT")
[ "$EXTRAS" = "1" ] && ARGS+=(--extras)
for F in $FLAGS; do case "$F" in *=*) ARGS+=("--${F%%=*}" "${F#*=}");; *) ARGS+=("--$F");; esac; done
"$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/run.ts" "${ARGS[@]}"
STATUS=$?
kill $APPIUMPID $LOGPID $USEPID $CKPID 2> /dev/null
# Crash reports of the app or WebKit, if any.
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
gzip -f "$OUT/unified.txt" "$OUT/appium.txt" 2> /dev/null
exit $STATUS
