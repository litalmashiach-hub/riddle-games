#!/bin/bash
# TEST ONLY. Every 5 min, the results so far go to the branch test/app-play-out/<label>, so that a
# run whose Mac dies (run 45510500698: "The hosted runner lost communication with the server")
# still leaves what it saw. The big raw logs are left out; their last lines go in tail-*.txt.
#   checkpoint.sh <out dir> <label>      (needs CHECKPOINT_URL, the repository's push address)
OUT="$1"; LABEL="$2"
[ -z "${CHECKPOINT_URL:-}" ] && exit 0
NAME=(-c user.name="app-play run" -c user.email="actions@users.noreply.github.com")
while :; do
  sleep 300
  D=$(mktemp -d)
  rsync -a --exclude appium.txt --exclude unified.txt "$OUT/" "$D/" 2> /dev/null
  tail -n 400 "$OUT/appium.txt" > "$D/tail-appium.txt" 2> /dev/null
  tail -n 200 "$OUT/unified.txt" > "$D/tail-unified.txt" 2> /dev/null
  ( cd "$D" && git init -q -b results && git "${NAME[@]}" add -A \
    && git "${NAME[@]}" commit -q -m "TEST ONLY: app-play checkpoint $(date +%H:%M:%S), $LABEL" \
    && git push -q -f "$CHECKPOINT_URL" "results:refs/heads/test/app-play-out/$LABEL" ) > /dev/null 2>&1
  rm -rf "$D"
done
