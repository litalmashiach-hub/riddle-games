#!/bin/bash
# TEST ONLY. Every 20 s: memory and processor use on the hosted Mac, and the biggest processes with
# their compressed memory. If the Mac starts swapping hard (more than 50000 pages written out in one
# round, about 0.8 GB), the app is stopped, so the run can go on to the next level instead of the
# whole Mac freezing; the line "WATCHDOG" says when and why.
#   watch-usage.sh <out dir> <simulator udid> <bundle id>
OUT="$1"; UDID="$2"; BUNDLE="$3"
swapouts() { vm_stat | awk '/Swapouts/ { gsub("\\.", "", $2); print $2 }'; }
PREV=$(swapouts)
while :; do
  NOW=$(swapouts)
  {
    echo "== $(date +%H:%M:%S) swapouts $NOW (+$((NOW - PREV))) load $(sysctl -n vm.loadavg)"
    vm_stat | grep -E "free|compressor"
    top -l 1 -o mem -n 8 -stats pid,command,mem,cmprs 2> /dev/null | tail -n 9
  } >> "$OUT/usage.txt" 2>&1
  if [ $((NOW - PREV)) -gt 50000 ]; then
    echo "$(date +%H:%M:%S) WATCHDOG: the Mac wrote $((NOW - PREV)) pages to swap in one round; stopping the app" | tee -a "$OUT/usage.txt" >> "$OUT/watchdog.txt"
    top -l 1 -o mem -n 12 -stats pid,command,mem,cmprs,cpu 2> /dev/null | tail -n 13 >> "$OUT/watchdog.txt"
    xcrun simctl terminate "$UDID" "$BUNDLE" >> "$OUT/watchdog.txt" 2>&1
  fi
  PREV=$NOW
  sleep 20
done
