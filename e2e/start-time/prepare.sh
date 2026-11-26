#!/bin/bash
# TEST ONLY. prepare.sh <tree> <bundle suffix>: builds that tree's app content with the probe, logging on, own bundle id, and the simulator app.
set -euo pipefail
T="$1"; SUF="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$T"
pnpm install --frozen-lockfile > /dev/null
pnpm build:app > build-app.log 2>&1 || { cat build-app.log; exit 1; }
ls -la apps/web/dist-app/assets/*.js | awk '{s+=$5} END {print "js files:", NR, "bytes:", s}'
ls -laS apps/web/dist-app/assets/*.js | head -n 3
python3 - "$HERE/probe.js" apps/web/dist-app/index.html <<'PY'
import sys
probe=open(sys.argv[1]).read(); p=sys.argv[2]; s=open(p).read()
s=s.replace('<head>', '<head>\n<script>'+probe+'</script>', 1); open(p,'w').write(s)
PY
python3 - <<'PY'
p='apps/mobile/capacitor.config.ts'; s=open(p).read()
s=s.replace("  backgroundColor: '#0f2236',", "  backgroundColor: '#0f2236',\n  loggingBehavior: 'production',", 1); open(p,'w').write(s)
PY
sed -i '' "s/^APP_BUNDLE_ID = \(.*\)$/APP_BUNDLE_ID = \1$SUF/" apps/mobile/ios/AppIdentity.xcconfig
grep '^APP_BUNDLE_ID' apps/mobile/ios/AppIdentity.xcconfig
pnpm --filter @riddle/mobile exec cap sync ios > sync.log 2>&1 || { cat sync.log; exit 1; }
set -o pipefail
xcodebuild -project apps/mobile/ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO build | tail -n 3
