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

# The device: with RUNTIME set (such as com.apple.CoreSimulator.SimRuntime.iOS-15-0), a new one of that
# type on exactly that runtime; else an existing one by its name, else made on the newest iOS runtime.
UDID=""
if [ -n "${RUNTIME:-}" ]; then
  TYPE=$(xcrun simctl list devicetypes -j | python3 -c "import json,sys; print([t['identifier'] for t in json.load(sys.stdin)['devicetypes'] if t['name']=='$NAME'][0])")
  UDID=$(xcrun simctl create "$NAME ($RUNTIME)" "$TYPE" "$RUNTIME") || { echo "cannot make $NAME on $RUNTIME"; exit 1; }
fi
[ -z "$UDID" ] && UDID=$(xcrun simctl list devices available -j | python3 -c "
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

# Before any test tool: open the app by the system alone and take the simulator's own pictures, so what the
# game draws on this device is seen even if Appium never reaches the web view. Also say whether the system's
# web inspector is running, which Appium needs to read the page.
mkdir -p "$OUT/shots"
xcrun simctl spawn "$UDID" launchctl list 2>&1 | grep -i -E "webinspector|webkit" | tee "$OUT/inspector-before.txt"
xcrun simctl launch "$UDID" "$BUNDLE" | tee -a "$OUT/device.txt"
for S in 20 60 120; do
  sleep $(( S - ${PREV_S:-0} )); PREV_S=$S
  xcrun simctl io "$UDID" screenshot "$OUT/shots/$LABEL-system-launch-${S}s.png" > /dev/null 2>&1 && echo "system picture at ${S} s" | tee -a "$OUT/device.txt"
done
xcrun simctl spawn "$UDID" launchctl list 2>&1 | grep -i -E "webinspector|webkit" | tee "$OUT/inspector-after-launch.txt"
xcrun simctl terminate "$UDID" "$BUNDLE" || true
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
# A hard stop, so a stuck run still leaves time to keep its results (perl's alarm: macOS has no timeout command).
perl -e 'alarm shift; exec @ARGV' "${RUN_SECONDS:-3600}" "$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/run.ts" "${ARGS[@]}"
STATUS=$?
echo "run ended with status $STATUS" | tee -a "$OUT/device.txt"
kill $APPIUMPID $LOGPID $USEPID $CKPID 2> /dev/null
# Crash reports of the app or WebKit, if any.
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
# Keep big logs small enough to commit: the first 4 MB and the last 12 MB of anything over 20 MB.
for F in "$OUT/appium.txt" "$OUT/unified.txt"; do
  if [ -f "$F" ] && [ "$(stat -f %z "$F")" -gt 20000000 ]; then
    { head -c 4000000 "$F"; printf '\n\n[... cut by ios-play.sh: %s bytes in all ...]\n\n' "$(stat -f %z "$F")"; tail -c 12000000 "$F"; } > "$F.cut" && mv "$F.cut" "$F"
  fi
done
gzip -f "$OUT/unified.txt" "$OUT/appium.txt" 2> /dev/null
exit $STATUS
