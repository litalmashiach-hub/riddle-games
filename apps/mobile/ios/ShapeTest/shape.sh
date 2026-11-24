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

shot() {
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$1.png" > /dev/null 2>&1 || return 0
  echo "picture $1.png at $(now)"
  # A small copy into the log at once, as text, so it is there even if a later step hangs.
  sips -s format jpeg -s formatOptions 60 -Z 1100 "$OUT/$1.png" --out "$OUT/p.jpg" > /dev/null 2>&1 || return 0
  echo "-----BEGIN PICTURE $LABEL-$1.jpg-----"
  base64 -i "$OUT/p.jpg" | fold -w 160
  echo "-----END PICTURE-----"
}
limited() { perl -e 'alarm shift; exec @ARGV' "$@"; }

uitest() {
  echo "---- UI test $1"
  TEST_RUNNER_SHAPE_APP_NAME="$APP_NAME" xcodebuild test-without-building \
    -project "$ROOT/apps/mobile/ios/ShapeTest/ShapeTest.xcodeproj" -scheme ShapeTest \
    -destination "id=$UDID" -derivedDataPath "$ROOT/build/shapetest" \
    -parallel-testing-enabled NO -only-testing:"ShapeUITests/ShapeTests/$1" > "$OUT/uitest-$1.log" 2>&1
  echo "exit code $?"
  grep -E "SHAPE|Test Case|\*\* TEST|error:" "$OUT/uitest-$1.log" | cut -c1-300 | head -n 12
}

# A launch filmed by the simulator itself, then cut into one frame per tenth of a second.
filmed() {
  echo "---- launch, filmed ($1)"
  mkdir -p "$OUT/$1-film"
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  sleep 2
  xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$OUT/$1-launch.mov" > "$OUT/record.log" 2>&1 &
  local rec=$!
  sleep 4
  shot "$1-home-before-launch"
  local start; start=$(now)
  xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1
  echo "launch call returned after $(perl -e "printf '%.1f', $(now) - $start") s; the film began about 4 to 6 s before the launch call"
  sleep "$2"
  shot "$1-after-launch"
  kill -INT "$rec"
  ( sleep 20; kill -9 "$rec" 2> /dev/null ) &
  wait "$rec" 2> /dev/null
  cat "$OUT/record.log" | head -n 5
  ls -la "$OUT/$1-launch.mov" || return
  limited 300 "$ROOT/build/frames" "$OUT/$1-launch.mov" "$OUT/$1-film" 2>&1 | tail -n 4
  limited 240 python3 "$ROOT/apps/mobile/ios/ShapeTest/frames.py" "$OUT/$1-film" "$LABEL-$1"
}

uitest testShowIcon
sleep 2; shot "upright-home-icon"
if [ "$KIND" = "iphone" ]; then filmed upright-first 40; fi
filmed upright-second 25

if [ "$KIND" = "ipad" ]; then
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  uitest testTurnSideways
  uitest testShowIcon
  sleep 2; shot "sideways-home-icon"
  filmed sideways 30
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true
  uitest testTurnUpright
fi

echo "---- errors and faults of the app in the unified log"
xcrun simctl spawn "$UDID" log show --last 15m --style compact \
  --predicate 'process == "App" AND (messageType == error OR messageType == fault)' 2> /dev/null | cut -c1-260 | tail -n 30 || true

rm -f "$OUT/p.jpg"
xcrun simctl shutdown "$UDID" || true
