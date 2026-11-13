"""Add (or replace) one building in src/data/interiors.json from a downloaded room.

Usage:
  python -I tools/asset-pipeline/add_interior.py <id> <pieces.json> <stations> <effect_color> <effect_ms> [walkthrough names...]

  <pieces.json>  the JSON `pixellab_fetch.py room` printed (w, h, pieces[])
  <stations>     "x,y,face;x,y,face;..." one per shop slot (face: up/down/left/right)
  walkthrough    piece names the player can walk over (rugs, pebbles)

Every room from create_room here is 256x256 with one south door at column 3,
so walls, doorway and arrival point are the same for all. Observations only:
it writes the entry and prints what it wrote; the parser and tests judge it.
"""
import json
import sys

ROOT = "src/data/interiors.json"


def main():
    bid, pieces_path, stations, color, every = sys.argv[1:6]
    walkthrough = set(sys.argv[6:])
    d = json.load(open(pieces_path, encoding="utf-8"))
    pieces = []
    for p in d["pieces"]:
        e = {k: p[k] for k in ("n", "x", "y", "w", "h", "foot")}
        if "shadow" in p:
            e["shadow"] = p["shadow"]
        if p["name"] in walkthrough:
            e["solid"] = False
        e["name"] = p["name"]
        pieces.append(e)
    st = []
    for s in stations.split(";"):
        x, y, face = s.split(",")
        st.append({"x": int(x), "y": int(y), "face": face})
    data = json.load(open(ROOT, encoding="utf-8"))
    data[bid] = {
        "shopId": bid,
        "dir": bid,
        "width": d["w"],
        "height": d["h"],
        "gridSize": 16,
        "blockDepth": 14,
        "blockInset": 3,
        "walkable": [{"x": 16, "y": 48, "w": 224, "h": 192}, {"x": 112, "y": 240, "w": 32, "h": 16}],
        "exits": [{"to": "town", "rect": {"x": 112, "y": 242, "w": 32, "h": 14}, "arrive": {"x": 128, "y": 222}}],
        "stations": st,
        "effect": {"color": color, "everyMs": int(every)},
        "pieces": pieces,
    }
    open(ROOT, "w", newline="\n").write(json.dumps(data, indent=1) + "\n")
    print(json.dumps({"id": bid, "pieces": len(pieces), "stations": st}))


if __name__ == "__main__":
    main()
