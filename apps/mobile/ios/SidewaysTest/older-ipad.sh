#!/bin/bash
# TEST ONLY. older-ipad.sh <iOS version>: downloads that iOS simulator runtime (the hosted Mac has only iOS 26)
# and makes one iPad simulator on it, so that run.sh's "older" slot finds it.
set -uo pipefail
VERSION="$1"
echo "SW downloading the iOS $VERSION simulator runtime"
time xcodebuild -downloadPlatform iOS -buildVersion "$VERSION" 2>&1 | tail -n 15
xcrun simctl list runtimes
RUNTIME="$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
v = sys.argv[1]
for r in json.load(sys.stdin)["runtimes"]:
    if r["platform"] == "iOS" and r["version"].startswith(v) and r["isAvailable"]:
        print(r["identifier"]); break
' "$VERSION")"
if [ -z "$RUNTIME" ]; then echo "SW no iOS $VERSION runtime after the download"; exit 0; fi
for TYPE in "iPad Air 11-inch (M2)" "iPad Pro 11-inch (M4)" "iPad (10th generation)" "iPad Air (5th generation)"; do
  if xcrun simctl create "$TYPE" "$TYPE" "$RUNTIME"; then echo "SW made $TYPE on $RUNTIME"; break; fi
done
xcrun simctl list devices available | grep -E "^--|iPad"
