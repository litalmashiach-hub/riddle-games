# Test only. frames.py <folder of frames named by their time> <label>
# One line per frame with the colours of its 4 by 4 reduction, and the frame itself (as text) each time the
# picture has changed, so the log shows every step of a launch.
import base64
import os
import struct
import subprocess
import sys

folder, label = sys.argv[1], sys.argv[2]
tiny = os.path.join(folder, "tiny.bmp")


def cells(path):
    subprocess.run(["sips", "-z", "4", "4", "-s", "format", "bmp", path, "--out", tiny], capture_output=True)
    b = open(tiny, "rb").read()
    off = struct.unpack("<I", b[10:14])[0]
    height = struct.unpack("<i", b[22:26])[0]
    bpp = struct.unpack("<H", b[28:30])[0] // 8
    row = (4 * bpp + 3) // 4 * 4
    px = b[off:]
    rows = [[(px[y * row + x * bpp + 2], px[y * row + x * bpp + 1], px[y * row + x * bpp]) for x in range(4)] for y in range(4)]
    if height > 0:
        rows.reverse()
    return [c for r in rows for c in r]


last_line, last_shown, shown = None, None, 0
names = sorted(n for n in os.listdir(folder) if n.endswith(".jpg"))
for i, name in enumerate(names):
    path = os.path.join(folder, name)
    try:
        c = cells(path)
    except Exception as e:  # noqa: BLE001
        print("frame", name, "unreadable", e)
        continue
    line = " ".join("%02x%02x%02x" % p for p in c)
    if line != last_line:
        print("frame", label, name[:-4], "s:", line)
        last_line = line
    diff = 999 if last_shown is None else max(abs(a - b) for p, q in zip(c, last_shown) for a, b in zip(p, q))
    if (diff > 10 or i == len(names) - 1) and shown < 40:
        print("-----BEGIN PICTURE %s-frame-%s.jpg-----" % (label, name[:-4]))
        data = base64.b64encode(open(path, "rb").read()).decode()
        for k in range(0, len(data), 160):
            print(data[k:k + 160])
        print("-----END PICTURE-----")
        last_shown = c
        shown += 1
if os.path.exists(tiny):
    os.remove(tiny)
