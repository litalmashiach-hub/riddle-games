#!/bin/bash
# TEST ONLY. shoot.sh <simulator name> <label>
# Boots one simulator, installs the built app, runs the UI test that launches it, and while the app's screenshot
# director holds each scene, takes pictures from the Mac with simctl at the simulator's full pixel size.
set -uo pipefail
SIM_NAME="$1"; LABEL="$2"
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT/frames"
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }

UDID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
name = sys.argv[1]
runtimes = json.load(sys.stdin)["devices"]
for runtime in sorted(runtimes, reverse=True):
    if "iOS" not in runtime: continue
    for d in runtimes[runtime]:
        if d["name"] == name:
            print(runtime, d["udid"]); sys.exit(0)
' "$SIM_NAME" | awk '{print $2}')"
if [ -z "$UDID" ]; then echo "No simulator named $SIM_NAME"; exit 1; fi
echo "Simulator: $SIM_NAME $UDID" | tee "$OUT/device.txt"
xcrun simctl list devices | grep "$UDID" | tee -a "$OUT/device.txt"

APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
xcrun simctl install "$UDID" "$APP"
# What the simulator itself says about its screen.
xcrun simctl io "$UDID" enumerate 2>/dev/null | head -n 40 | tee -a "$OUT/device.txt" || true

TEST_RUNNER_SHOOT_OUT="$OUT" TEST_RUNNER_SHOOT_BUNDLE_ID="$BUNDLE_ID" \
xcodebuild test -project "$ROOT/apps/mobile/ios/StoreShots/StoreShots.xcodeproj" -scheme StoreShots \
  -destination "id=$UDID" -derivedDataPath "$ROOT/build/storeshots" \
  -parallel-testing-enabled NO -disable-concurrent-destination-testing \
  -resultBundlePath "$OUT/result.xcresult" > "$OUT/xcodebuild.log" 2>&1 &
XP=$!

# Pictures: while a scene is up, one picture after another. Scenes with a move in motion get more.
while kill -0 "$XP" 2> /dev/null; do
  CUR="$(cat "$OUT/current" 2> /dev/null || true)"
  if [ -n "$CUR" ] && [ "$CUR" != "done" ]; then
    MAX=12; GAP=0
    N=$(ls "$OUT/frames/$CUR" 2> /dev/null | wc -l | tr -d " ")
    if [ "$N" -lt "$MAX" ]; then
      mkdir -p "$OUT/frames/$CUR"
      F="$OUT/frames/$CUR/$(printf %02d "$N").png"
      xcrun simctl io "$UDID" screenshot --type=png --mask=ignored "$F" > /dev/null 2>&1 && echo "$(now) $CUR $(basename "$F")" >> "$OUT/frames.txt"
      sleep "$GAP"
      continue
    fi
  fi
  sleep 0.5
done
wait "$XP"; echo "xcodebuild test exit code: $?"
cat "$OUT/test-log.txt" 2> /dev/null
grep -E "Test Case|Executed|\*\* TEST|error:" "$OUT/xcodebuild.log" | head -n 20
xcrun simctl shutdown "$UDID" || true
