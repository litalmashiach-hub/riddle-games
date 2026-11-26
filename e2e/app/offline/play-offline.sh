#!/bin/bash
# TEST ONLY. The app with the network cut off, on one iPhone simulator.
#   play-offline.sh <label> <device name> <orientation> <levels> <run flags> <extras steps>
# 1. Boots the simulator and installs the app as it ships (no test hooks, its web view closed to tools).
# 2. Cuts the network (cut.sh) and proves it: a request from the Mac and one from Safari in the simulator.
# 3. Opens the shipping app cold by the system alone, sends it to the background and back, and relaunches
#    it, taking the simulator's own pictures. No test tool touches it.
# 4. Swaps in the test build (the same app plus read-only hooks and an open web view) and plays it with
#    Appium by real touches: the levels, a loss and Undo, the About pages, a return from the background,
#    relaunches, and last the test's own request from inside the web view, which must fail.
# 5. Proves the cut held, gives the network back (restore.sh), and sums up what pf saw.
set -u
LABEL="$1"; NAME="$2"; ORIENT="$3"; LEVELS="$4"; FLAGS="$5"; STEPS="$6"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/out/$LABEL"; SHOTS="$OUT/shots"; mkdir -p "$SHOTS"
PLAIN="$ROOT/build/plain/App.app"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')
say() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$OUT/offline-log.txt"; }
pic() { xcrun simctl io "$UDID" screenshot "$SHOTS/$LABEL-$1.png" > /dev/null 2>&1 && say "picture $1"; }

UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(x['udid']); sys.exit()")
if [ -z "$UDID" ]; then
  TYPE=$(xcrun simctl list devicetypes -j | python3 -c "import json,sys; print([t['identifier'] for t in json.load(sys.stdin)['devicetypes'] if t['name']=='$NAME'][0])")
  RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['isAvailable'] and x['platform']=='iOS']; r.sort(key=lambda x:[int(n) for n in x['version'].split('.')]); print(r[-1]['identifier'])")
  UDID=$(xcrun simctl create "$NAME" "$TYPE" "$RT")
fi
[ -z "$UDID" ] && { say "no simulator for $NAME"; exit 1; }
say "device $NAME: $UDID"
xcrun simctl list devices | grep "$UDID" | tee "$OUT/device.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
say "booted"
xcrun simctl install "$UDID" "$PLAIN" && say "installed the shipping build"
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLAIN/Info.plist" | tee -a "$OUT/device.txt"
# Let the freshly booted system settle (its own first-boot jobs), before the cut.
sleep 60

# The simulator's own log of the network, the app and its web view, for the whole run.
xcrun simctl spawn "$UDID" log stream --style compact --level info --predicate 'subsystem == "com.apple.network" OR subsystem == "com.apple.CFNetwork" OR process == "App" OR process CONTAINS "WebKit" OR process CONTAINS "WebContent"' > "$OUT/sim-network-log.txt" 2>&1 &
LOGPID=$!

"$ROOT/e2e/app/offline/cut.sh" "$OUT" || { say "the cut failed"; exit 3; }
proof() {
  say "proof ($1): a request from the Mac to https://example.com"
  curl -sS -m 15 -o /dev/null -w 'HTTP %{http_code}\n' https://example.com/ >> "$OUT/net/proof-$1.txt" 2>&1; echo "exit $?" >> "$OUT/net/proof-$1.txt"
  curl -sS -m 15 -o /dev/null -w 'HTTP %{http_code}\n' https://www.apple.com/ >> "$OUT/net/proof-$1.txt" 2>&1; echo "exit $?" >> "$OUT/net/proof-$1.txt"
  cat "$OUT/net/proof-$1.txt" | tee -a "$OUT/offline-log.txt"
}
proof before
# A cut that lets the Mac reach the web is no cut: stop here (run 45871836919 played with the network on).
if grep -q 'HTTP 200' "$OUT/net/proof-before.txt"; then say "the network is NOT cut: stopping"; "$ROOT/e2e/app/offline/restore.sh" "$OUT"; exit 4; fi
say "proof (before): Safari in the simulator opens https://example.com"
xcrun simctl openurl "$UDID" "https://example.com/" ; sleep 30; pic "00-safari-example-com-network-cut"
xcrun simctl terminate "$UDID" com.apple.mobilesafari || true
sleep 3

say "shipping build: cold open by the system"
T0=$(date +%s)
xcrun simctl launch "$UDID" "$BUNDLE" | tee -a "$OUT/offline-log.txt"
for S in 3 8 20 60 120; do sleep $(( S - (${PREV:-0}) )); PREV=$S; pic "01-ship-cold-open-${S}s"; done
say "shipping build: to the background (Settings opened over it) for 10 s, and back"
xcrun simctl launch "$UDID" com.apple.Preferences > /dev/null; sleep 10; pic "02-ship-settings-over-app"
xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null; sleep 5; pic "03-ship-back-5s"; sleep 15; pic "03-ship-back-20s"
say "shipping build: quit and relaunch"
xcrun simctl terminate "$UDID" "$BUNDLE"; sleep 3
xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null; sleep 20; pic "04-ship-relaunch-20s"; sleep 40; pic "04-ship-relaunch-60s"
xcrun simctl terminate "$UDID" "$BUNDLE" || true
xcrun simctl uninstall "$UDID" "$BUNDLE"
xcrun simctl install "$UDID" "$APP" && say "installed the test build (same app, plus read-only hooks and an open web view)"
xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null; sleep 60; pic "05-test-build-cold-open-60s"
xcrun simctl terminate "$UDID" "$BUNDLE" || true

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
 'appium:webviewConnectRetries':20,'appium:additionalWebviewBundleIds':['*'],'appium:forceAppLaunch':True
}))")
ARGS=(--backend appium --device "$LABEL" --levels "$LEVELS" --out "$OUT" --caps "$CAPS" --bundle-id "$BUNDLE" --extras --extras-steps "$STEPS")
[ "$ORIENT" != "-" ] && ARGS+=(--orientation "$ORIENT")
for F in $FLAGS; do case "$F" in *=*) ARGS+=("--${F%%=*}" "${F#*=}");; *) ARGS+=("--$F");; esac; done
say "test build: play by Appium"
perl -e 'alarm shift; exec @ARGV' "${RUN_SECONDS:-4200}" "$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/run.ts" "${ARGS[@]}"
STATUS=$?
say "play ended with status $STATUS"
kill $APPIUMPID $USEPID 2> /dev/null
pic "06-end-of-play"
proof after
sleep 2
kill $LOGPID 2> /dev/null
"$ROOT/e2e/app/offline/restore.sh" "$OUT"
python3 "$ROOT/e2e/app/offline/summary.py" "$OUT" | tee "$OUT/net/summary.txt"
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
ls "$OUT/crashes" | tee "$OUT/crashes.txt"
for F in "$OUT/appium.txt" "$OUT/sim-network-log.txt" "$OUT/net/sockets.txt" "$OUT/net/pflog.txt"; do
  if [ -f "$F" ] && [ "$(stat -f %z "$F")" -gt 20000000 ]; then
    { head -c 4000000 "$F"; printf '\n\n[... cut: %s bytes in all ...]\n\n' "$(stat -f %z "$F")"; tail -c 12000000 "$F"; } > "$F.cut" && mv "$F.cut" "$F"
  fi
done
gzip -f "$OUT/appium.txt" "$OUT/sim-network-log.txt" "$OUT/net/sockets.txt" "$OUT/net/pflog.txt" 2> /dev/null
rm -f "$OUT/net/pflog.pcap"
exit $STATUS
