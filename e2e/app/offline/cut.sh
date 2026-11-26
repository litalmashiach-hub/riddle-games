#!/bin/bash
# TEST ONLY. Cuts this hosted Mac's network for the iOS simulator, with the Mac's packet filter (pf).
# The simulator has no network of its own: its apps use the Mac's. So pf refuses every connection
# out of the Mac (a refusal answered at once, as with no network), bar three things kept open:
#   - the loopback, which the test tools (Appium, WebDriverAgent) talk over;
#   - the GitHub runner's own link (the addresses it is connected to now, and those of the hosts
#     its own logs and settings name, looked up again every 20 s), or the job would be lost;
#   (Rules on the runner's addresses take TCP packets of any kind, so links already open when pf starts go on.)
#   - name lookups (port 53), so the runner can find its hosts again. Each lookup is logged, so a
#     name the app asks for shows up even though no connection to it can be made.
# Everything pf passes or refuses is logged (pflog0, into net/pflog.pcap), and every socket on the Mac
# with its process is listed every 2 s (net/sockets.txt), so each attempt can be pinned on a process.
#   cut.sh <out dir>
set -u
N="$1/net"; mkdir -p "$N"
HOSTS="github.com api.github.com codeload.github.com"
for v in ACTIONS_RUNTIME_URL ACTIONS_RESULTS_URL ACTIONS_CACHE_URL ACTIONS_ID_TOKEN_REQUEST_URL GITHUB_SERVER_URL GITHUB_API_URL; do
  u="${!v:-}"; h=$(printf '%s' "$u" | sed -nE 's#^[a-z]+://([^/:]+).*#\1#p'); [ -n "$h" ] && HOSTS="$HOSTS $h"
done
DIAGS=$(find /Users/runner /opt /Users/runner/actions-runner -maxdepth 4 -type d -name _diag 2> /dev/null | sort -u)
echo "runner logs: $DIAGS" > "$N/cut-log.txt"
for d in $DIAGS; do
  HOSTS="$HOSTS $(grep -rhoE 'https?://[a-zA-Z0-9.-]+\.[a-z]{2,}' "$d" 2> /dev/null | sed -E 's#^https?://##' | sort -u | tr '\n' ' ')"
done
HOSTS=$(echo "$HOSTS" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
echo "$HOSTS" > "$N/runner-hosts.txt"
resolve() { for h in $HOSTS; do dig +short +time=2 +tries=1 A "$h"; dig +short +time=2 +tries=1 AAAA "$h"; done 2> /dev/null | grep -E '^[0-9a-f:.]+$' | grep -E '[.:]' ; }
# The connections open now, of every process that is not the simulator's (the app has not been opened yet).
held() {
  sudo lsof -nP -i -sTCP:ESTABLISHED -F pn 2> /dev/null | python3 -c '
import sys, subprocess
pid = None
for line in sys.stdin:
    line = line.strip()
    if line.startswith("p"): pid = line[1:]
    elif line.startswith("n") and "->" in line:
        exe = subprocess.run(["ps", "-o", "comm=", "-p", pid], capture_output=True, text=True).stdout.strip()
        if "CoreSimulator" in exe or ".simruntime" in exe or "/RuntimeRoot/" in exe: continue
        remote = line.split("->")[1].rsplit(":", 1)[0].strip("[]")
        if remote not in ("127.0.0.1", "::1"): print(remote, "#", exe)
'
}
held | tee "$N/held-at-cut.txt" | awk '{print $1}' > "$N/keep.txt"
resolve >> "$N/keep.txt"
sort -u -o "$N/keep.txt" "$N/keep.txt"
echo "kept addresses: $(wc -l < "$N/keep.txt")" | tee -a "$N/cut-log.txt"
cat > "$N/pf.conf" <<PF
set skip on lo0
table <ghrun> persist file "$N/keep.txt"
block return log all
pass quick inet6 proto ipv6-icmp all
pass out quick proto udp from any port 68 to any port 67
pass out log quick proto { tcp udp } from any to any port 53 keep state
pass out log quick proto tcp to <ghrun> flags any keep state
pass out log quick proto udp to <ghrun> keep state
pass in quick proto tcp from <ghrun> flags any keep state
pass in quick proto udp from <ghrun> keep state
PF
# ("keep" is a word of pf's own, so the table is named ghrun: run 45871836919's rules did not load.)
sudo pfctl -nf "$N/pf.conf" >> "$N/cut-log.txt" 2>&1 || { echo "the rules do not parse; no cut" | tee -a "$N/cut-log.txt"; exit 3; }
sudo pfctl -E 2>&1 | tee "$N/pf-token.txt"
sudo pfctl -f "$N/pf.conf" 2>&1 | tee -a "$N/cut-log.txt"
sudo pfctl -s Tables 2>&1 | tee -a "$N/cut-log.txt"
sudo pfctl -sr > "$N/pf-rules-in-force.txt" 2>&1
sudo ifconfig pflog0 create 2> /dev/null || true
sudo tcpdump -n -e -s 0 -i pflog0 -w "$N/pflog.pcap" > /dev/null 2> "$N/tcpdump-err.txt" &
echo $! > "$N/tcpdump.pid"
( while :; do echo "== $(date -u +%H:%M:%S)"; sudo lsof -nP -i 2> /dev/null | grep -v -E '127\.0\.0\.1|\[::1\]|localhost' ; sleep 2; done ) > "$N/sockets.txt" 2>&1 &
echo $! > "$N/sockets.pid"
( while :; do sleep 20; for ip in $(resolve); do sudo pfctl -t ghrun -T add "$ip" > /dev/null 2>&1; done; done ) &
echo $! > "$N/refresh.pid"
# A safety: whatever happens to the run, the network comes back after 110 minutes.
( sleep 6600; sudo pfctl -d ) > /dev/null 2>&1 &
echo $! > "$N/safety.pid"
date -u +%FT%TZ > "$N/cut-at.txt"
echo "network cut at $(cat "$N/cut-at.txt")" | tee -a "$N/cut-log.txt"
