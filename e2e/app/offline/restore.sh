#!/bin/bash
# TEST ONLY. Ends the cut of cut.sh, and turns what pf logged into text.
#   restore.sh <out dir>
set -u
N="$1/net"
date -u +%FT%TZ > "$N/restored-at.txt"
for p in sockets refresh safety tcpdump; do [ -f "$N/$p.pid" ] && sudo kill "$(cat "$N/$p.pid")" 2> /dev/null; done
sleep 2
sudo pfctl -sr > "$N/pf-rules-at-end.txt" 2>&1
sudo pfctl -t keep -T show 2> /dev/null | wc -l | sed 's/^/kept addresses at the end: /' >> "$N/cut-log.txt"
sudo pfctl -f /etc/pf.conf > /dev/null 2>&1
sudo pfctl -d 2>&1 | tee -a "$N/cut-log.txt"
sudo chmod a+r "$N"/* 2> /dev/null
tcpdump -n -e -tttt -v -r "$N/pflog.pcap" > "$N/pflog.txt" 2> /dev/null || sudo tcpdump -n -e -tttt -v -r "$N/pflog.pcap" > "$N/pflog.txt" 2> /dev/null
echo "network back at $(cat "$N/restored-at.txt")" | tee -a "$N/cut-log.txt"
