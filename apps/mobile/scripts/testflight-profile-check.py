# Reads an App Store provisioning profile's plist (decoded by `security cms -D`) for testflight-signing.sh.
# Prints four lines: the profile's UUID, its name, its expiry, and a reason to refuse it (empty if none).
# Environment: TEAM_ID, BUNDLE_ID, SIGN_SHA1 (the imported certificate's SHA-1, in capitals).
import datetime, hashlib, os, plistlib, sys
with open(sys.argv[1], "rb") as f:
    p = plistlib.load(f)
name = p.get("Name", "?")
ent = p.get("Entitlements", {})
team, bundle, sha1 = os.environ["TEAM_ID"], os.environ["BUNDLE_ID"], os.environ["SIGN_SHA1"]
why = ""
if not p.get("UUID"):
    why = "The provisioning profile has no UUID; download it again from Apple's page."
elif "ProvisionedDevices" in p or p.get("ProvisionsAllDevices") or ent.get("get-task-allow"):
    why = f'The profile "{name}" is a development, ad hoc or enterprise profile. Make one under Distribution, App Store Connect.'
elif team not in p.get("TeamIdentifier", []):
    why = f'The profile "{name}" is for another team than APPLE_TEAM_ID.'
elif ent.get("application-identifier") != f"{team}.{bundle}":
    other = str(ent.get("application-identifier", "")).split(".", 1)[-1]
    why = f'The profile "{name}" is for the app identifier {other}, not {bundle}. Make the profile for {bundle}.'
elif p.get("ExpirationDate") and p["ExpirationDate"].replace(tzinfo=None) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(hours=1):
    why = f'The profile "{name}" has expired. Make it again on Apple\'s page.'
elif sha1 not in [hashlib.sha1(c).hexdigest().upper() for c in p.get("DeveloperCertificates", [])]:
    why = (f'The profile "{name}" was made for another certificate. Edit it on Apple\'s page, tick the Apple '
           "Distribution certificate you made, save, download it, and run make-signing-files.sh finish again.")
print(p.get("UUID", ""))
print(name)
print(p.get("ExpirationDate", ""))
print(why)
