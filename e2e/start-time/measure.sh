#!/bin/bash
# TEST ONLY. measure.sh <device name> <out dir> <fresh rounds> <warm rounds>
# Times launch -> tappable level map for the app before (main) and after (this branch), turn about, on one simulator.
set -u
NAME="$1"; OUT="$2"; FRESH="$3"; WARM="$4"
mkdir -p "$OUT"
APP_B=before/build/ios/Build/Products/Release-iphonesimulator/App.app
APP_A=after/build/ios/Build/Products/Release-iphonesimulator/App.app
ID_B=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_B/Info.plist")
ID_A=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_A/Info.plist")
UDID=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for rt in sorted(d, reverse=True):
  for x in d[rt]:
    if x['name']=='$NAME': print(x['udid']); sys.exit()")
[ -z "$UDID" ] && { echo "no simulator $NAME"; exit 1; }
xcrun simctl list devices | grep "$UDID" | tee "$OUT/device.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
sleep 30   # let the fresh system settle
ms() { python3 -c 'import time; print(int(time.time()*1000))'; }
one() { # one <label> <bundle> <kind> <round>
  local L="$1" B="$2" K="$3" R="$4" LOG="$OUT/console-$1-$3-$4.txt"
  xcrun simctl terminate "$UDID" "$B" > /dev/null 2>&1 || true
  sleep 3
  local T0; T0=$(ms)
  xcrun simctl launch --console-pty "$UDID" "$B" > "$LOG" 2>&1 &
  local P=$!
  local GOT=""
  for i in $(seq 1 600); do
    GOT=$(grep -a 'STARTPROBE map' "$LOG" | head -n 1)
    [ -n "$GOT" ] && break
    sleep 0.2
  done
  kill $P 2> /dev/null; wait $P 2> /dev/null
  xcrun simctl terminate "$UDID" "$B" > /dev/null 2>&1 || true
  local HTML; HTML=$(grep -a 'STARTPROBE html' "$LOG" | head -n 1)
  python3 - "$L" "$K" "$R" "$T0" "$GOT" "$HTML" >> "$OUT/runs.jsonl" <<'PY'
import json,sys,re
l,k,r,t0,got,html=sys.argv[1:7]
def parse(s):
  m=re.search(r'STARTPROBE \w+ (\d+) (\d+)', s); return (int(m.group(1)), int(m.group(2))) if m else (None,None)
me,mp=parse(got); he,hp=parse(html); t0=int(t0)
print(json.dumps({'app':l,'kind':k,'round':int(r),'launch_to_map_ms':(me-t0) if me else None,'launch_to_html_ms':(he-t0) if he else None,'page_to_map_ms':mp}))
PY
  tail -n 1 "$OUT/runs.jsonl"
}
for r in $(seq 1 "$FRESH"); do
  for L in $([ $((r % 2)) = 1 ] && echo "before after" || echo "after before"); do
    [ "$L" = before ] && { A=$APP_B; B=$ID_B; } || { A=$APP_A; B=$ID_A; }
    xcrun simctl uninstall "$UDID" "$B" > /dev/null 2>&1 || true
    xcrun simctl install "$UDID" "$A"
    one "$L" "$B" first-open "$r"
  done
done
for r in $(seq 1 "$WARM"); do
  for L in $([ $((r % 2)) = 1 ] && echo "before after" || echo "after before"); do
    [ "$L" = before ] && B=$ID_B || B=$ID_A
    one "$L" "$B" relaunch "$r"
  done
done
xcrun simctl io "$UDID" screenshot "$OUT/last-screen.png" > /dev/null 2>&1 || true
python3 - "$OUT/runs.jsonl" <<'PY' | tee "$OUT/summary.txt"
import json,sys,statistics as st
rows=[json.loads(l) for l in open(sys.argv[1])]
for kind in ('first-open','relaunch'):
  for app in ('before','after'):
    v=sorted(x['launch_to_map_ms'] for x in rows if x['app']==app and x['kind']==kind and x['launch_to_map_ms'])
    p=sorted(x['page_to_map_ms'] for x in rows if x['app']==app and x['kind']==kind and x['page_to_map_ms'])
    miss=sum(1 for x in rows if x['app']==app and x['kind']==kind and not x['launch_to_map_ms'])
    if v: print(f"{kind:10} {app:6} launch->map ms: median {st.median(v):.0f} min {v[0]} max {v[-1]} n {len(v)} missing {miss} | page->map median {st.median(p) if p else '-'}")
    else: print(f"{kind:10} {app:6} no result, missing {miss}")
PY
