# TEST ONLY. Picks an iPad simulator: "newest" is the newest iOS runtime's, "older" the newest one of an earlier major version.
import json, re, sys

slot = sys.argv[1]
runtimes = json.load(sys.stdin)["devices"]
found = []
for runtime, devices in runtimes.items():
    m = re.search(r"SimRuntime\.iOS-(\d+)-(\d+)", runtime)
    if not m:
        continue
    version = (int(m.group(1)), int(m.group(2)))
    pads = [d for d in devices if d["name"].startswith("iPad")]
    if not pads:
        continue
    # Prefer an 11-inch iPad: fewer pixels for the hosted Mac to draw.
    pads.sort(key=lambda d: (0 if "11-inch" in d["name"] else 1 if "iPad (" in d["name"] else 2, d["name"]))
    found.append((version, pads[0]))
found.sort(key=lambda f: f[0])
if not found:
    sys.exit(0)
newest = found[-1]
if slot == "newest":
    pick = newest
else:
    older = [f for f in found if f[0][0] < newest[0][0]]
    if not older:
        sys.exit(0)
    pick = older[-1]
print("%s|%s|%d.%d" % (pick[1]["udid"], pick[1]["name"], pick[0][0], pick[0][1]))
