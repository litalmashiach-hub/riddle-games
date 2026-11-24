#!/bin/bash
# Test only. play.sh <simulator name> <label> <release|debug-console> <max levels> [hd from level]
# Boots one simulator, installs the built app, times its launch with screenshots taken from the Mac,
# then runs the UI test that plays the game by taps. Everything it finds goes to out/<label>/.
set -uo pipefail
SIM_NAME="$1"; LABEL="$2"; MODE="$3"; MAX_LEVELS="$4"; HD_FROM="${5:-0}"
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT/shots" "$OUT/frames"
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }

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
if [ -z "$UDID" ]; then echo "No simulator named $SIM_NAME"; echo "no simulator" > "$OUT/status"; exit 1; fi
echo "Simulator: $SIM_NAME $UDID"

if [ "$MODE" = "release" ]; then APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"; else APP="$ROOT/build/ios/Build/Products/Debug-iphonesimulator/App.app"; fi
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"

T=$(now)
xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
echo "TIMING $LABEL simulator boot: $(perl -e "printf '%.1f', $(now) - $T") s"
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"

# Screenshots in a loop from the Mac, for the given number of seconds, each named with its clock time.
frames() {
  local dir="$1" secs="$2" start; start=$(now)
  while perl -e "exit(($(now) - $start) < $secs ? 0 : 1)"; do
    local t; t=$(now)
    xcrun simctl io "$UDID" screenshot --type=jpeg "$dir/$t.jpg" > /dev/null 2>&1 || true
  done
}

if [ "$MODE" = "release" ]; then
  for n in 1 2 3; do
    mkdir -p "$OUT/frames/launch$n"
    frames "$OUT/frames/launch$n" 16 &
    FP=$!
    sleep 1
    frames "$OUT/frames/launch$n" 15 &
    sleep 1
    L=$(now)
    xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null
    echo "TIMING $LABEL launch $n: launch command given at $L, returned at $(now)"
    echo "$L" > "$OUT/frames/launch$n/launch-time.txt"
    wait
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" || true
    sleep 2
  done
  # A clean start for the play test: no saved stars.
  xcrun simctl uninstall "$UDID" "$BUNDLE_ID" || true
  xcrun simctl install "$UDID" "$APP"
fi

ATTACH=0
if [ "$MODE" = "debug-console" ]; then
  # The Debug build prints the web view's console to the app's output. Keep it in a file.
  ( xcrun simctl launch --console-pty "$UDID" "$BUNDLE_ID" > "$OUT/console.txt" 2>&1 ) &
  ATTACH=1
  sleep 25
fi

set +e
TEST_RUNNER_PLAY_OUT="$OUT/shots" \
TEST_RUNNER_PLAY_STEPS_DIR="$ROOT/apps/mobile/ios/PlayTest/UITests" \
TEST_RUNNER_PLAY_MAX_LEVELS="$MAX_LEVELS" \
TEST_RUNNER_PLAY_HD_FROM_LEVEL="$HD_FROM" \
TEST_RUNNER_PLAY_ATTACH="$ATTACH" \
TEST_RUNNER_PLAY_BUNDLE_ID="$BUNDLE_ID" \
xcodebuild test -project "$ROOT/apps/mobile/ios/PlayTest/PlayTest.xcodeproj" -scheme PlayTest \
  -destination "id=$UDID" -derivedDataPath "$ROOT/build/playtest" \
  -parallel-testing-enabled NO -disable-concurrent-destination-testing \
  -resultBundlePath "$OUT/result.xcresult" > "$OUT/xcodebuild.log" 2>&1
RC=$?
echo "xcodebuild test exit code: $RC"
# The test reports by its RESULT line, not by failing.
WON="$(cat "$OUT/xcodebuild.log" "$OUT/shots/play-log.txt" 2> /dev/null | sed -n 's/.*RESULT levelsWon=\([0-9]*\).*/\1/p' | head -n 1)"
echo "levels won by taps: ${WON:-none reported}"
if [ "${WON:-0}" -ge 1 ]; then echo 0 > "$OUT/status"; else echo 1 > "$OUT/status"; fi
if grep -q "PLAY|" "$OUT/xcodebuild.log"; then
  grep -E "PLAY\||Test Case|Executed|\*\* TEST" "$OUT/xcodebuild.log" || true
elif [ -f "$OUT/shots/play-log.txt" ]; then
  echo "(from the test's own log file)"; cat "$OUT/shots/play-log.txt"
fi
if [ "$RC" != "0" ]; then echo "---- last lines of xcodebuild's output"; tail -n 60 "$OUT/xcodebuild.log" | cut -c1-400; fi
if ! ls "$OUT/shots"/*.png > /dev/null 2>&1; then
  echo "No pictures written by the test; exporting the result bundle's attachments instead"
  xcrun xcresulttool export attachments --path "$OUT/result.xcresult" --output-path "$OUT/shots" || true
  ls -la "$OUT/shots" || true
fi

xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
sleep 2
if [ "$MODE" = "debug-console" ]; then
  echo "---- web view console and app output (Debug build): $(wc -l < "$OUT/console.txt") lines"
  echo "lines that mention an error: $(grep -c -i -E "error|exception|unhandled|failed" "$OUT/console.txt" || true)"
  cut -c1-500 "$OUT/console.txt" | head -n 250
  echo "---- end of console"
fi

echo "---- unified log, errors and faults of the app and its web view processes (last 25 minutes)"
xcrun simctl spawn "$UDID" log show --last 25m --style compact \
  --predicate '(process == "App" OR process BEGINSWITH "com.apple.WebKit") AND (messageType == error OR messageType == fault)' \
  > "$OUT/unified.txt" 2> /dev/null || true
echo "lines: $(wc -l < "$OUT/unified.txt")"
echo "lines that mention a crash, a kill or memory pressure: $(grep -c -i -E "crash|jetsam|killed|terminated|memory warning|exceeded" "$OUT/unified.txt" || true)"
grep -i -E "crash|jetsam|killed|terminated|memory warning|exceeded" "$OUT/unified.txt" | cut -c1-300 | head -n 40 || true
echo "-- most frequent messages"
cut -c40-200 "$OUT/unified.txt" | sed -E 's/[0-9a-fx]{6,}/N/g; s/[0-9]+/N/g' | sort | uniq -c | sort -rn | head -n 25 || true
echo "---- crash reports on the Mac that name the app or WebKit"
ls -la "$HOME/Library/Logs/DiagnosticReports" 2> /dev/null | grep -i -E "App|WebKit|WebContent" || echo "none"

xcrun simctl shutdown "$UDID" || true
