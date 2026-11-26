#!/bin/bash
# TEST ONLY (branch test/app-reduce-motion). Reduce Motion inside the built app, on one iPhone simulator.
#   play-rm.sh <label> <device name> <levels>
# 1. Boots the simulator with Reduce Motion off, installs the test build, plays the pass "off" (rm.ts).
# 2. Switches Reduce Motion on in the simulator's own accessibility settings (defaults write
#    com.apple.Accessibility ReduceMotionEnabled, and the system's change notice), and reads, in the running
#    app's web view, whether the page saw it at once ("live").
# 3. Restarts the simulator so every process reads the setting afresh, plays the pass "on".
# 4. Switches it off again, restarts, and reads the page once more: it must say no-preference again.
set -u
LABEL="$1"; NAME="$2"; LEVELS="$3"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/out/$LABEL"; mkdir -p "$OUT"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')
say() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$OUT/steps.txt"; }

UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(x['udid']); sys.exit()")
[ -z "$UDID" ] && { say "no simulator for $NAME"; exit 1; }
say "device $NAME: $UDID"
xcrun simctl list devices | grep "$UDID" | tee "$OUT/device.txt"
{ echo "== xcrun simctl help ui"; xcrun simctl help ui 2>&1; } > "$OUT/simctl-ui-help.txt"

AX() { xcrun simctl spawn "$UDID" defaults read com.apple.Accessibility ReduceMotionEnabled 2>&1; }
setrm() {
  # $1 = 1 or 0
  local B=false; [ "$1" = 1 ] && B=true
  xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceMotionEnabled -bool $B 2>&1 | tee -a "$OUT/steps.txt"
  xcrun simctl spawn "$UDID" notifyutil -p com.apple.accessibility.reduce.motion.status 2>&1 | tee -a "$OUT/steps.txt"
  say "Reduce Motion set to $B; the simulator's accessibility settings now read: $(AX)"
}
reboot() {
  xcrun simctl shutdown "$UDID" 2>&1 | tee -a "$OUT/steps.txt"
  xcrun simctl boot "$UDID" 2>&1 | tee -a "$OUT/steps.txt"
  xcrun simctl bootstatus "$UDID" -b > /dev/null
  say "simulator restarted; Reduce Motion reads: $(AX)"
  sleep 30
}

xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
say "booted; Reduce Motion reads at first: $(AX)"
setrm 0
reboot
# The 'ui' command of simctl, in case this Xcode offers a motion option there (logged, not relied on).
xcrun simctl ui "$UDID" 2>&1 | head -20 >> "$OUT/simctl-ui-help.txt"
xcrun simctl install "$UDID" "$APP" && say "installed the test build"

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
# For the live read: attach to the app as it runs, without starting it again.
CAPS_LIVE=$(echo "$CAPS" | python3 -c "import json,sys; c=json.load(sys.stdin); c['appium:forceAppLaunch']=False; c['appium:shouldTerminateApp']=False; print(json.dumps(c))")
RM() { local C="$CAPS"; [ "$2" = live ] && C="$CAPS_LIVE"; perl -e 'alarm shift; exec @ARGV' "$1" "$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/reduce-motion/rm.ts" --udid "$UDID" --out "$OUT" --caps "$C" --levels "$LEVELS" "${@:3}"; echo "exit $?" | tee -a "$OUT/steps.txt"; }

say "pass off"
RM 2400 - --pass off
say "switching Reduce Motion on while the app runs"
xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null 2>&1; sleep 10
setrm 1
sleep 5
RM 600 live --pass on-live --probe-only
xcrun simctl terminate "$UDID" "$BUNDLE" 2> /dev/null
reboot
say "pass on"
RM 2400 - --pass on
setrm 0
reboot
say "after switching it off again"
RM 600 - --pass off-again --probe-only
kill $APPIUMPID 2> /dev/null
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
gzip -f "$OUT/appium.txt" 2> /dev/null
say "done"
