#!/bin/bash
# TEST ONLY (branch test/app-preview-video). Films the preview video's scenes in the built app on one iPhone
# simulator (preview.ts), then makes one film per scene from the pictures with ffmpeg.
#   play-preview.sh <label> <device name>
set -u
LABEL="$1"; NAME="$2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/out/$LABEL"; mkdir -p "$OUT"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE=$(sed -n 's/^APP_BUNDLE_ID *= *//p' "$ROOT/apps/mobile/ios/AppIdentity.xcconfig" | tr -d ' ')
say() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$OUT/steps.txt"; }

FOUND=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(rt, x['udid']); sys.exit()")
[ -z "$FOUND" ] && { say "no simulator for $NAME"; exit 1; }
RUNTIME=${FOUND% *}; UDID=${FOUND#* }
say "device $NAME: $UDID ($RUNTIME)"
xcrun simctl list devices | grep "$UDID" | tee "$OUT/device.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
# Reduce Motion off, as a player's default.
xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceMotionEnabled -bool false
xcrun simctl install "$UDID" "$APP" && say "installed the test build"
sleep 20

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
say "filming"
perl -e 'alarm shift; exec @ARGV' 7800 "$ROOT/e2e/app/node_modules/.bin/tsx" "$ROOT/e2e/app/preview/preview.ts" --out "$OUT" --caps "$CAPS" --quality high --settle 8000 --draw-wait 250
echo "exit $?" | tee -a "$OUT/steps.txt"
# One picture by the Mac's own capture too, to compare with XCTest's (the Mac's capture draws the Dynamic Island in).
xcrun simctl io "$UDID" screenshot --type=png "$OUT/simctl-picture.png" 2>&1 | tail -1
kill $APPIUMPID 2> /dev/null
mkdir -p "$OUT/crashes"
find ~/Library/Logs/DiagnosticReports -newer "$OUT/device.txt" \( -name 'App*' -o -name '*WebKit*' -o -name '*WebContent*' \) -exec cp {} "$OUT/crashes/" \; 2> /dev/null
gzip -f "$OUT/appium.txt" 2> /dev/null

say "films of each scene"
mkdir -p "$OUT/stills"
for d in "$OUT"/frames/*/; do
  n=$(basename "$d")
  [ -f "$d/f0000.png" ] || continue
  # The pictures as taken, scaled so the short side is 886 (Apple's preview size is 1920 by 886), nearly lossless.
  ffmpeg -loglevel error -y -framerate 30 -i "$d/f%04d.png" -vf "scale='if(gt(iw,ih),-2,886)':'if(gt(iw,ih),886,-2)':flags=lanczos" \
    -c:v libx264 -preset slow -crf 8 -pix_fmt yuv420p "$OUT/scene-$n.mp4" && say "scene-$n.mp4 made"
  # Three full-size pictures of each scene, as taken.
  for f in f0000 f0090 f0160; do [ -f "$d/$f.png" ] && cp "$d/$f.png" "$OUT/stills/$n-$f.png"; done
done
rm -rf "$OUT/frames"
say "done"
