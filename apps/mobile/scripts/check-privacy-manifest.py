#!/usr/bin/env python3
"""Checks the app's privacy manifest without a Mac: it is there, it is in the app target's resources,
and it says what docs/ios-app.md ("The privacy manifest") says it does.

    python3 apps/mobile/scripts/check-privacy-manifest.py

The file is a statement to Apple, so this check is strict on purpose: it knows the four keys and what
each holds today. If the app really changes (a plugin or Swift code that uses one of Apple's "required
reason" APIs, any network use, any data collected), change the manifest, docs/ios-app.md and EXPECTED
below together, in the same pull request.
"""
import plistlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = ROOT / "apps/mobile/ios/App/App/PrivacyInfo.xcprivacy"
PROJECT = ROOT / "apps/mobile/ios/App/App.xcodeproj/project.pbxproj"

# What the manifest declares today: no tracking, no tracking domain, no collected data, no required-reason API.
EXPECTED = {
    "NSPrivacyTracking": False,
    "NSPrivacyTrackingDomains": [],
    "NSPrivacyCollectedDataTypes": [],
    "NSPrivacyAccessedAPITypes": [],
}


def check() -> list[str]:
    if not MANIFEST.is_file():
        return [f"{MANIFEST.relative_to(ROOT)} is missing. Apple expects the app to carry its privacy manifest."]
    try:
        with MANIFEST.open("rb") as f:
            manifest = plistlib.load(f)
    except Exception as e:  # plistlib raises several kinds of error for a broken file
        return [f"{MANIFEST.relative_to(ROOT)} is not a valid property list: {e}"]
    if not isinstance(manifest, dict):
        return [f"{MANIFEST.relative_to(ROOT)}: the top level must be a dictionary."]

    faults = []
    for key, want in EXPECTED.items():
        if key not in manifest:
            faults.append(f"{key} is missing.")
        elif type(manifest[key]) is not type(want) or manifest[key] != want:
            faults.append(f"{key} is {manifest[key]!r}, expected {want!r}.")
    for key in sorted(set(manifest) - set(EXPECTED)):
        faults.append(f"{key} is a key this check does not know.")

    # A manifest that is not in the target's resources is not copied into the built app.
    project = PROJECT.read_text(encoding="utf-8") if PROJECT.is_file() else ""
    resources = re.search(r"/\* Begin PBXResourcesBuildPhase section \*/(.*?)/\* End PBXResourcesBuildPhase section \*/", project, re.S)
    if not resources or "PrivacyInfo.xcprivacy in Resources" not in resources.group(1):
        faults.append(f"{PROJECT.relative_to(ROOT)} does not list PrivacyInfo.xcprivacy in the app target's resources, so the built app would not carry it.")
    return faults


def main() -> int:
    faults = check()
    if faults:
        print("The privacy manifest check failed:")
        for fault in faults:
            print(f"  - {fault}")
        print('See docs/ios-app.md, "The privacy manifest". If the change is meant, update the manifest, that page and this check together.')
        return 1
    print("Privacy manifest: present, in the app target's resources, and it declares no tracking, no tracking domains, no collected data and no required-reason API.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
