#!/bin/bash
# TEST ONLY. run.sh <newest|older> <label> <step>...
# Boots one iPad simulator, installs the built app and runs the named UI test steps, each as its own short run.
set -uo pipefail
SLOT="$1"; LABEL="$2"; shift 2
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT"
PICK="$(xcrun simctl list devices available -j | python3 "$ROOT/apps/mobile/ios/SidewaysTest/pick.py" "$SLOT")"
if [ -z "$PICK" ]; then echo "SW no iPad simulator for slot $SLOT on this runner"; echo "none" > "$OUT/no-simulator.txt"; exit 0; fi
UDID="${PICK%%|*}"; REST="${PICK#*|}"
echo "SW simulator: $REST ($UDID)"
echo "$REST" > "$OUT/simulator.txt"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
xcrun simctl install "$UDID" "$APP"
sleep 5
N=0
for STEP in "$@"; do
  N=$((N + 1))
  echo "---- step $N $STEP"
  TEST_RUNNER_SW_OUT="$OUT" TEST_RUNNER_SW_STEP="$N-$STEP" TEST_RUNNER_SW_BUNDLE="$BUNDLE_ID" \
  perl -e 'alarm shift; exec @ARGV' 420 xcodebuild test-without-building \
    -project "$ROOT/apps/mobile/ios/SidewaysTest/SidewaysTest.xcodeproj" -scheme SidewaysTest \
    -destination "platform=iOS Simulator,id=$UDID" -destination-timeout 180 -derivedDataPath "$ROOT/build/sidewaystest" \
    -parallel-testing-enabled NO -only-testing:"SidewaysUITests/SidewaysTests/$STEP" > "$OUT/$N-$STEP.log" 2>&1
  echo "exit code $?"
  grep -E "SW |Test Case|\*\* TEST|error:" "$OUT/$N-$STEP.log" | cut -c1-400 | head -n 60
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  ps -axo rss,comm | grep -i SimRenderServer | grep -v grep | awk '{printf "SW SimRenderServer %d MB\n", $1/1024}'
done
xcrun simctl io "$UDID" screenshot --type=png "$OUT/zz-simctl-last.png" > /dev/null 2>&1 || true
echo "---- the app's errors and faults in the unified log"
xcrun simctl spawn "$UDID" log show --last 20m --style compact \
  --predicate 'process == "App" AND (messageType == error OR messageType == fault)' 2> /dev/null | cut -c1-260 | tail -n 25 > "$OUT/app-errors.txt" || true
xcrun simctl spawn "$UDID" defaults read com.apple.springboard > "$OUT/springboard-defaults.txt" 2>&1 || true
xcrun simctl shutdown "$UDID" || true
# Smaller pictures to carry away.
for f in "$OUT"/*.png; do [ -f "$f" ] || continue; sips -s format jpeg -s formatOptions 70 -Z 1600 "$f" --out "${f%.png}.jpg" > /dev/null 2>&1 && rm "$f"; done
ls -la "$OUT"
