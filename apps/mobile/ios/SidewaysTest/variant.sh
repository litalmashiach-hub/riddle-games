#!/bin/bash
# TEST ONLY. variant.sh <main|key|nokey>: changes the shell's settings in the working copy before the build.
set -euo pipefail
PLIST=apps/mobile/ios/App/App/Info.plist
SWIFT=apps/mobile/ios/App/App/GameViewController.swift
PB=/usr/libexec/PlistBuddy
sideways() {
  $PB -c "Delete :UISupportedInterfaceOrientations~ipad" "$PLIST"
  $PB -c "Add :UISupportedInterfaceOrientations~ipad array" "$PLIST"
  $PB -c "Add :UISupportedInterfaceOrientations~ipad:0 string UIInterfaceOrientationLandscapeLeft" "$PLIST"
  $PB -c "Add :UISupportedInterfaceOrientations~ipad:1 string UIInterfaceOrientationLandscapeRight" "$PLIST"
  perl -0pi -e 's/UIDevice\.current\.userInterfaceIdiom == \.phone \? \.landscape : \.all/.landscape/' "$SWIFT"
  grep -n "landscape" "$SWIFT"
}
case "$1" in
  main) ;;
  key) sideways; $PB -c "Add :UIRequiresFullScreen bool true" "$PLIST" ;;
  nokey) sideways ;;
  *) echo "unknown variant $1"; exit 1 ;;
esac
plutil -p "$PLIST" | grep -A6 -E "Orientations|FullScreen" || true
