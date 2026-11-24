#!/bin/bash
# Test only. launch.sh <simulator name> <label>
# Single pictures of the app's launch in one simulator, printed into the log as small JPEGs.
#  1. an ordinary launch
#  2. a launch that is sent to the background at once, and brought back 30 s later
#  3. a launch of a copy of the app whose page never starts its script, so the first frame never comes
set -uo pipefail
SIM_NAME="$1"; LABEL="$2"
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/out/$LABEL"; mkdir -p "$OUT"
now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
since() { perl -e "printf '%.1f', $(now) - $1"; }

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
if [ -z "$UDID" ]; then echo "No simulator named $SIM_NAME"; xcrun simctl list devices available; exit 1; fi
echo "Simulator: $SIM_NAME $UDID"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")"

# The copy whose page never starts: the same built app, with the script tags taken out of its page.
BROKEN="$ROOT/build/broken/App.app"
mkdir -p "$ROOT/build/broken"; cp -R "$APP" "$BROKEN"
python3 -c '
import re, sys
p = sys.argv[1]
s = open(p).read()
t, n = re.subn(r"<script\b[^>]*>.*?</script>", "", s, flags=re.S)
t, m = re.subn(r"<link[^>]*modulepreload[^>]*>", "", t)
open(p, "w").write(t)
print("script tags taken out of the page of the copy:", n, "preloads:", m)
' "$BROKEN/public/index.html"

xcrun simctl boot "$UDID" 2>&1 | grep -v "current state: Booted" || true
xcrun simctl bootstatus "$UDID" > /dev/null
sleep 20

# watch <name> <seconds> <t0>: a picture about every second and a half, times counted from t0.
watch() {
  local name="$1" secs="$2" t0="$3" i=0
  while [ "$(perl -e "print(($(now) - $t0) < $secs ? 1 : 0)")" = "1" ]; do
    i=$((i + 1)); local n; n=$(printf '%02d' "$i")
    local before; before=$(since "$t0")
    xcrun simctl io "$UDID" screenshot --type=png "$OUT/$name-$n.png" > /dev/null 2>&1
    echo "SHOT $LABEL-$name-$n asked at +${before}s, written at +$(since "$t0")s"
    sleep 0.7
  done
  for f in "$OUT/$name"-*.png; do
    local b; b=$(basename "$f" .png)
    sips -s format jpeg -s formatOptions 45 -Z 420 "$f" --out "$OUT/p.jpg" > /dev/null 2>&1 || continue
    echo "-----BEGIN PICTURE $LABEL-$b.jpg-----"
    base64 -i "$OUT/p.jpg" | fold -w 160
    echo "-----END PICTURE-----"
  done
}
fresh() { xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2> /dev/null || true; sleep 3; }

echo "==== 0. a warm-up launch after install, not judged (the first one on a new simulator is very slow)"
xcrun simctl install "$UDID" "$APP"; sleep 5
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1; sleep 45
T=$(now); watch warmup 3 "$T"

echo "==== 1. an ordinary launch"
fresh; T=$(now)
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1
echo "launch call returned at +$(since "$T")s"
watch ordinary 30 "$T"

echo "==== 2. launched, sent to the background at once, brought back 30 s later"
fresh; T=$(now)
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1
echo "launch call returned at +$(since "$T")s"
xcrun simctl launch "$UDID" com.apple.Preferences > /dev/null 2>&1
echo "Settings opened over it at +$(since "$T")s"
watch background-away 4 "$T"
sleep 26
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1
echo "brought back at +$(since "$T")s"
watch background-back 40 "$T"
xcrun simctl terminate "$UDID" com.apple.Preferences 2> /dev/null || true

echo "==== 3. the copy whose page never starts its script"
fresh
xcrun simctl install "$UDID" "$BROKEN"; sleep 5
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1; sleep 30   # warm-up of the new install, not judged
fresh; T=$(now)
xcrun simctl launch "$UDID" "$BUNDLE_ID" > /dev/null 2>&1
echo "launch call returned at +$(since "$T")s"
watch never-drawn 42 "$T"

echo "---- errors and faults of the app in the unified log"
xcrun simctl spawn "$UDID" log show --last 10m --style compact \
  --predicate 'process == "App" AND (messageType == error OR messageType == fault)' 2> /dev/null | cut -c1-220 | tail -n 15 || true
xcrun simctl shutdown "$UDID" || true
echo "==== done"
