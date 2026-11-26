#!/bin/bash
# TEST ONLY. carry.sh <label>: puts out/<label> on a branch of its own, test/ipad-sideways-out/<label>.
set -uo pipefail
LABEL="$1"
cp build.log "out/$LABEL/" 2> /dev/null || true
cd "out/$LABEL" || exit 0
git init -q -b out
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "TEST ONLY: iPad sideways look, $LABEL, run $GITHUB_RUN_ID"
git push -f "https://x-access-token:$GH_TOKEN@github.com/$GITHUB_REPOSITORY.git" "out:refs/heads/test/ipad-sideways-out/$LABEL"
