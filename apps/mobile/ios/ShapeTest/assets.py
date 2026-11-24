# Test only. Lists the pictures inside a built asset catalogue, from `assetutil --info`.
import json
import sys

for r in json.load(open(sys.argv[1])):
    if "Name" in r:
        print(r.get("Name"), r.get("RenditionName"), r.get("PixelWidth"), "x", r.get("PixelHeight"),
              "idiom", r.get("Idiom"), "scale", r.get("Scale"), "opaque", r.get("Opaque"))
