#!/bin/bash
# TEST ONLY. feel.sh <simulator name> <label>: boots one simulator, installs the Debug app, runs the UI test.
set -uo pipefail
SIM_NAME="$1"; LABEL="$2"
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT"
UDID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
name = sys.argv[1]
runtimes = json.load(sys.stdin)["devices"]
for runtime in sorted(runtimes, reverse=True):
    if "iOS" not in runtime: continue
    for d in runtimes[runtime]:
        if d["name"] == name:
            print(d["udid"]); sys.exit(0)
' "$SIM_NAME")"
if [ -z "$UDID" ]; then echo "No simulator named $SIM_NAME"; exit 1; fi
echo "Simulator: $SIM_NAME $UDID"
APP="$ROOT/build/ios/Build/Products/Debug-iphonesimulator/App.app"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"

LIMIT=1500
TEST_RUNNER_FEEL_OUT="$OUT" TEST_RUNNER_FEEL_BUNDLE_ID="$BUNDLE_ID" \
xcodebuild test -project "$ROOT/apps/mobile/ios/FeelTest/FeelTest.xcodeproj" -scheme FeelTest \
  -destination "id=$UDID" -derivedDataPath "$ROOT/build/feeltest" \
  -parallel-testing-enabled NO -disable-concurrent-destination-testing > "$OUT/xcodebuild.log" 2>&1 &
XP=$!
( sleep "$LIMIT"; echo "WATCHDOG: stopped after $LIMIT s"; kill -9 "$XP"; pkill -9 -f FeelTestUITests-Runner ) &
WP=$!
wait "$XP"; RC=$?
kill "$WP" 2> /dev/null
echo "xcodebuild test exit code: $RC"
echo "---- the test's own log"
if [ -s "$OUT/feel-log.txt" ]; then cut -c1-3000 "$OUT/feel-log.txt"; else tail -n 60 "$OUT/xcodebuild.log"; fi
grep -E "Test Case|Executed|\*\* TEST" "$OUT/xcodebuild.log" | head -n 8 || true
echo "---- crash reports on the Mac that name the app or WebKit"
ls "$HOME/Library/Logs/DiagnosticReports" 2> /dev/null | grep -E "App|WebKit|WebContent|GPU" || echo none
xcrun simctl shutdown "$UDID" || true
# Small copies of the pictures, for the artifact.
mkdir -p "$OUT/small"
for f in "$OUT"/*.png; do
  [ -f "$f" ] || continue
  sips -s format jpeg -s formatOptions 70 -Z 1600 "$f" --out "$OUT/small/$(basename "$f" .png).jpg" > /dev/null 2>&1 || true
done
# The pictures as text in the log, small, for readers who can open a log but not an artifact.
for f in "$OUT"/01-*.png "$OUT"/05-*.png "$OUT"/06-*.png "$OUT"/07-*.png "$OUT"/09-*.png "$OUT"/10-*.png "$OUT"/11-*.png; do
  [ -f "$f" ] || continue
  sips -s format jpeg -s formatOptions 60 -Z 1200 "$f" --out "$OUT/p.jpg" > /dev/null 2>&1 || continue
  echo "-----BEGIN PICTURE $LABEL-$(basename "$f" .png)-----"
  base64 -i "$OUT/p.jpg" | fold -w 160
  echo "-----END PICTURE-----"
done
grep -q "RESULT done" "$OUT/feel-log.txt"
