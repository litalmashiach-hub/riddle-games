# Test only. Prints the 16 colours of a 4 by 4 BMP, top row first.
import struct
import sys

name, path = sys.argv[1], sys.argv[2]
b = open(path, "rb").read()
off = struct.unpack("<I", b[10:14])[0]
height = struct.unpack("<i", b[22:26])[0]
bpp = struct.unpack("<H", b[28:30])[0] // 8
px = b[off:]
row = (4 * bpp + 3) // 4 * 4
rows = []
for y in range(4):
    cells = []
    for x in range(4):
        i = y * row + x * bpp
        cells.append("%02x%02x%02x" % (px[i + 2], px[i + 1], px[i]))
    rows.append(" ".join(cells))
if height > 0:
    rows.reverse()
print("frame", name.rsplit("/", 1)[1], " | ".join(rows))
