#!/bin/bash
# Test only. shape.sh <simulator name> <label> <iphone|ipad>
# Boots one simulator, installs the built app, and takes pictures of the launch screen, the launch itself
# and the home-screen icon. Everything goes to out/<label>/.
set -uo pipefail
SIM_NAME="$1"; LABEL="$2"; KIND="$3"
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"
mkdir -p "$OUT"
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
if [ -z "$UDID" ]; then echo "No simulator named $SIM_NAME"; exit 1; fi
echo "Simulator: $SIM_NAME $UDID"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"
APP_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$APP/Info.plist")"

xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
xcrun simctl install "$UDID" "$APP"
sleep 5
echo "---- the installed app, as the simulator reports it"
xcrun simctl appinfo "$UDID" "$BUNDLE_ID" 2>&1 | grep -E "CFBundle(Identifier|ShortVersionString|Version|DisplayName)|ApplicationType" || true
xcrun simctl listapps "$UDID" 2> /dev/null | plutil -convert json -o - - 2> /dev/null | python3 -c '
import json, sys
apps = json.load(sys.stdin)
a = apps.get(sys.argv[1], {})
for k in ("CFBundleIdentifier", "CFBundleDisplayName", "CFBundleShortVersionString", "CFBundleVersion"):
    print("listapps", k, "=", a.get(k))
' "$BUNDLE_ID" || true

shot() { xcrun simctl io "$UDID" screenshot --type=png "$OUT/$1.png" > /dev/null 2>&1 && echo "picture $1.png at $(now)"; }

uitest() {
  echo "---- UI test $1"
  TEST_RUNNER_SHAPE_APP_NAME="$APP_NAME" xcodebuild test-without-building \
    -project "$ROOT/apps/mobile/ios/ShapeTest/ShapeTest.xcodeproj" -scheme ShapeTest \
    -destination "id=$UDID" -derivedDataPath "$ROOT/build/shapetest" \
    -parallel-testing-enabled NO -only-testing:"ShapeUITests/ShapeTests/$1" > "$OUT/uitest-$1.log" 2>&1
  echo "exit code $?"
  grep -E "SHAPE|Test Case|\*\* TEST|error:" "$OUT/uitest-$1.log" | cut -c1-300 | head -n 12
}

# The launch screen alone: the app is started but held before its first line of code runs,
# so what the system shows is the launch screen and nothing of the app's own.
held() {
  echo "---- launch screen, app held before it runs ($1)"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  sleep 2
  ( xcrun simctl launch --wait-for-debugger "$UDID" "$BUNDLE_ID" 2>&1 | sed 's/^/launch: /' ) &
  sleep 5; shot "$1-launch-screen-held-5s"
  sleep 5; shot "$1-launch-screen-held-10s"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  pkill -f "simctl launch --wait-for-debugger" 2> /dev/null || true
  sleep 3
}

# A normal launch, with pictures taken as fast as the Mac allows, each named by seconds since the launch call.
launch_frames() {
  echo "---- normal launch, frame by frame ($1)"
  mkdir -p "$OUT/$1-frames"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  sleep 2
  local start; start=$(now)
  ( xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1; echo "launch call returned after $(perl -e "printf '%.1f', $(now) - $start") s" ) &
  while perl -e "exit(($(now) - $start) < $2 ? 0 : 1)"; do
    local t; t=$(perl -e "printf '%06.2f', $(now) - $start")
    xcrun simctl io "$UDID" screenshot --type=jpeg "$OUT/$1-frames/$t.jpg" > /dev/null 2>&1 || true
  done
  wait
  echo "frames: $(ls "$OUT/$1-frames" | wc -l | tr -d ' ')"
  # One line per frame: its time and the colours of a 4 by 4 reduction, so the log shows when the picture changed.
  for f in "$OUT/$1-frames"/*.jpg; do
    sips -z 4 4 -s format bmp "$f" --out "$OUT/tiny.bmp" > /dev/null 2>&1 || continue
    python3 "$ROOT/apps/mobile/ios/ShapeTest/tiny.py" "$f" "$OUT/tiny.bmp" || true
  done
  shot "$1-after-launch"
}

held upright
launch_frames upright 40
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
uitest testShowIcon
sleep 2; shot "upright-home-icon"

if [ "$KIND" = "ipad" ]; then
  uitest testTurnSideways
  sleep 2; shot "sideways-home-icon"
  held sideways
  launch_frames sideways 40
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  uitest testShowIcon
  sleep 2; shot "sideways-home-icon-2"
  uitest testTurnUpright
fi

echo "---- errors and faults of the app in the unified log"
xcrun simctl spawn "$UDID" log show --last 15m --style compact \
  --predicate 'process == "App" AND (messageType == error OR messageType == fault)' 2> /dev/null | cut -c1-260 | tail -n 30 || true

# Small copies of the main pictures into the log, as text.
for f in "$OUT"/*.png; do
  [ -f "$f" ] || continue
  sips -s format jpeg -s formatOptions 55 -Z 1000 "$f" --out "$OUT/p.jpg" > /dev/null 2>&1 || continue
  echo "-----BEGIN PICTURE $LABEL/$(basename "$f")-----"
  base64 -i "$OUT/p.jpg" | fold -w 160
  echo "-----END PICTURE-----"
done
rm -f "$OUT/p.jpg" "$OUT/tiny.bmp"
xcrun simctl shutdown "$UDID" || true
