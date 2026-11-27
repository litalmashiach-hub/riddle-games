#!/bin/bash
# TEST ONLY. Home screen pictures of the app icon on one simulator runtime.
#   shoot.sh <label> <runtime prefix, e.g. iOS-18> <looks, e.g. "light dark tinted">
set -u
LABEL="$1"; RT="$2"; LOOKS="$3"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/out/$LABEL"; mkdir -p "$OUT"
APP="$ROOT/build/ios/Build/Products/Release-iphonesimulator/App.app"
say() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$OUT/steps.txt"; }
UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  if '.SimRuntime.$RT' not in rt: continue
  for x in d[rt]:
    if x['name'].startswith('iPhone') and 'Pro' in x['name'] and 'Max' not in x['name']: print(x['udid']); sys.exit()
  for x in d[rt]:
    if x['name'].startswith('iPhone'): print(x['udid']); sys.exit()")
[ -z "$UDID" ] && { say "no iPhone simulator for $RT"; exit 0; }
xcrun simctl list devices | grep "$UDID" | tee "$OUT/device.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
say "booted"
xcrun simctl ui "$UDID" appearance light
sleep 60
xcrun simctl install "$UDID" "$APP" && say "installed"
sleep 20
xcrun simctl spawn "$UDID" defaults read com.apple.springboard > "$OUT/springboard-defaults-before.txt" 2>&1
xcrun simctl io "$UDID" screenshot --type=png "$OUT/home-as-installed.png"
export APPIUM_HOME="$ROOT/e2e/icon-variants/.appium"
"$ROOT/e2e/icon-variants/node_modules/.bin/appium" --address 127.0.0.1 --port 4723 --log-timestamp --log-no-colors --log "$OUT/appium.txt" --log-level info:debug > /dev/null 2>&1 &
APPIUMPID=$!
for i in $(seq 1 60); do curl -sf http://127.0.0.1:4723/status > /dev/null && break; sleep 2; done
for L in $LOOKS; do
  if [ "$L" = dark ]; then xcrun simctl ui "$UDID" appearance dark; else xcrun simctl ui "$UDID" appearance light; fi
  sleep 5
  perl -e 'alarm shift; exec @ARGV' 1500 node "$ROOT/e2e/icon-variants/springboard.mjs" "$UDID" "$L" "$OUT"
  say "$L: springboard exit $?"
  xcrun simctl spawn "$UDID" defaults read com.apple.springboard > "$OUT/springboard-defaults-$L.txt" 2>&1
  sleep 3
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/home-$L.png" && say "picture home-$L.png"
done
kill $APPIUMPID 2>/dev/null
xcrun simctl shutdown "$UDID" || true
