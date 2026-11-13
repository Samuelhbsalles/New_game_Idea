"""Fetch PixelLab assets into public/assets/ (stdlib only).

Usage:
  python -I tools/asset-pipeline/pixellab_fetch.py tileset <tileset_id> <out.png>
      Downloads the 16-tile Wang sheet and prints its wangToFrame table
      (index = NW*8 + NE*4 + SW*2 + SE*1, bit set = upper terrain).
  python -I tools/asset-pipeline/pixellab_fetch.py object <object_id> <out.png>
      Downloads a map object and crops it to its opaque pixels; prints the size.

Observations only: it reports what it fetched, it does not judge the art.
"""
import json
import struct
import sys
import urllib.request
import zlib

API = "https://api.pixellab.ai/mcp"


def fetch(url, tries=8):
    """GET with retries on 423 Locked (the asset is still being saved), honouring Retry-After."""
    import time
    import urllib.error

    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": "asset-pipeline"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 423 or attempt == tries - 1:
                raise
            time.sleep(min(30, int(e.headers.get("Retry-After") or 5)))


def decode_png(b):
    """Returns (w, h, rows) with rows as RGBA bytearrays; supports 8-bit gray/RGB/RGBA."""
    i, idat = 8, b""
    while i < len(b):
        n, = struct.unpack(">I", b[i:i + 4])
        t, c = b[i + 4:i + 8], b[i + 8:i + 8 + n]
        if t == b"IHDR":
            w, h, bd, ct = struct.unpack(">IIBB", c[:10])
        elif t == b"IDAT":
            idat += c
        i += 12 + n
    assert bd == 8 and ct in (0, 2, 6), (bd, ct)
    bpp = {0: 1, 2: 3, 6: 4}[ct]
    raw, stride, rows, prev, o = zlib.decompress(idat), w * bpp, [], bytearray(w * bpp), 0
    for _ in range(h):
        f = raw[o]
        o += 1
        line = bytearray(raw[o:o + stride])
        o += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            up = prev[x]
            ul = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + up) & 255
            elif f == 3:
                line[x] = (line[x] + (a + up) // 2) & 255
            elif f == 4:
                p = a + up - ul
                pa, pb, pc = abs(p - a), abs(p - up), abs(p - ul)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else ul)) & 255
        rows.append(line)
        prev = line
    if bpp != 4:
        rows = [bytearray(b"".join(bytes(r[x * bpp:(x + 1) * bpp]) + b"\xff" if bpp == 3 else bytes([r[x]] * 3 + [255]) for x in range(w))) for r in rows]
    return w, h, rows


def encode_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def tileset(tid, out):
    with open(out, "wb") as f:
        f.write(fetch(f"{API}/tilesets/{tid}/image?inline=true"))
    meta = json.loads(fetch(f"{API}/tilesets/{tid}/metadata"))
    tiles = meta["tileset_data"]["tiles"]
    w, _, _ = decode_png(open(out, "rb").read())
    cols = w // tiles[0]["bounding_box"]["width"]
    table = [-1] * 16
    for t in tiles:
        c, bb = t["corners"], t["bounding_box"]
        idx = sum(bit for k, bit in (("NW", 8), ("NE", 4), ("SW", 2), ("SE", 1)) if c[k] == "upper")
        table[idx] = (bb["y"] // bb["height"]) * cols + bb["x"] // bb["width"]
    print(json.dumps({"wangToFrame": table}))


def key_out_background(w, h, rows, tol=26):
    """For objects returned on a flat colour (canvases over 200x200): clear the
    background by flood-filling from the border with the most common border
    colour (the flat fill can come in two close shades, so `tol` covers both).
    Only pixels connected to the edge are cleared, so greys inside the
    building (glass, stone) stay. Returns how many pixels were cleared."""
    from collections import Counter

    border = [tuple(rows[0][x * 4:x * 4 + 3]) for x in range(w)] + [tuple(rows[h - 1][x * 4:x * 4 + 3]) for x in range(w)]
    border += [tuple(rows[y][0:3]) for y in range(h)] + [tuple(rows[y][(w - 1) * 4:(w - 1) * 4 + 3]) for y in range(h)]
    bg = Counter(border).most_common(1)[0][0]
    close = lambda p: abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) <= tol
    seen = [[False] * w for _ in range(h)]
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    cleared = 0
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or seen[y][x]:
            continue
        seen[y][x] = True
        p = rows[y][x * 4:x * 4 + 4]
        if not p[3] or not close(p):
            continue
        rows[y][x * 4 + 3] = 0
        cleared += 1
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return cleared


def obj(oid, out):
    w, h, rows = decode_png(fetch(f"{API}/map-objects/{oid}/download"))
    if all(r[x * 4 + 3] == 255 for r in rows for x in range(0, w, 7)):
        print(json.dumps({"keyed_background_px": key_out_background(w, h, rows)}))
    xs = [x for r in rows for x in range(w) if r[x * 4 + 3]]
    ys = [y for y, r in enumerate(rows) if any(r[x * 4 + 3] for x in range(w))]
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    encode_png(out, x1 - x0, y1 - y0, [r[x0 * 4:x1 * 4] for r in rows[y0:y1]])
    print(json.dumps({"out": out, "w": x1 - x0, "h": y1 - y0}))


DIRS = {"south": "down", "north": "up", "east": "right", "west": "left"}


def character(cid, dest):
    """dest = folder/name, e.g. public/assets/characters/npc_baker/npc_baker.
    Writes <name>_idle_<dir>_01.png for 4 facings and <name>_walk_<dir>_NN.png
    (01-based) for down/up/right (left is mirrored in the game)."""
    import io
    import os
    import zipfile

    z = zipfile.ZipFile(io.BytesIO(fetch(f"{API}/characters/{cid}/download")))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    names = z.namelist()
    counts = {}
    for n in names:
        parts = n.split("/")
        if "rotations" in parts and n.endswith(".png"):
            d = DIRS.get(parts[-1][:-4])
            if d:
                open(f"{dest}_idle_{d}_01.png", "wb").write(z.read(n))
        if "animations" in parts and n.endswith(".png"):
            i = parts.index("animations")
            # The animation's folder is its display name; "walk"/"walking..." is the walk
            # cycle, "eat" and "sleep" are down-only extras, "work" is drawn down/up/right
            # (see src/data/sprites.json).
            name = parts[i + 1].lower()
            action = "walk" if name.startswith("walk") else name if name in ("eat", "sleep", "work") else None
            d = DIRS.get(parts[i + 2])
            if not action or not d or d == "left" or (action not in ("walk", "work") and d != "down"):
                continue
            k = int(parts[-1][6:9]) + 1
            open(f"{dest}_{action}_{d}_{k:02d}.png", "wb").write(z.read(n))
            key = f"{action}_{d}"
            counts[key] = max(counts.get(key, 0), k)
    print(json.dumps({"frames": counts}))


def object_anim(oid, dest):
    """Writes every frame of a one-direction object's first animation as dest_NN.png (01-based)."""
    import io
    import zipfile

    z = zipfile.ZipFile(io.BytesIO(fetch(f"{API}/objects/{oid}/download")))
    frames = sorted(n for n in z.namelist() if n.startswith("animations/") and n.endswith(".png"))
    for k, n in enumerate(frames, 1):
        open(f"{dest}_{k:02d}.png", "wb").write(z.read(n))
    print(json.dumps({"frames": len(frames)}))


def image_frames(job_id, dest):
    """Writes each frame of an image job (e.g. animate_image) as dest_NN.png (01-based)."""
    import os

    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    k = 0
    while True:
        try:
            b = fetch(f"{API}/images/{job_id}/download?index={k}")
        except Exception:
            break
        if not b.startswith(b"\x89PNG"):
            break
        open(f"{dest}_{k + 1:02d}.png", "wb").write(b)
        k += 1
    print(json.dumps({"frames": k}))


def room(layers_url, dest):
    """A create_room's layers.json (URL from get_room) -> dest/floor.png (lit, no furniture),
    dest/piece_NN.png and dest/shadow_NN.png. Prints each piece's placement as JSON:
    top-left x,y, size, foot (lowest opaque row) and its shadow's top-left."""
    import base64
    import os

    os.makedirs(dest, exist_ok=True)
    data = json.loads(fetch(layers_url))

    def save(url, path):
        b = base64.b64decode(url.split(",", 1)[1])
        open(path, "wb").write(b)
        return struct.unpack(">II", b[16:24])

    save(data["lit"], os.path.join(dest, "floor.png"))
    pieces = []
    for i, s in enumerate(data["sprites"]):
        n = f"{i + 1:02d}"
        w, h = save(s["img"], os.path.join(dest, f"piece_{n}.png"))
        p = {"n": n, "name": s["name"], "x": s["x"], "y": s["y"], "w": w, "h": h, "foot": s["foot"]}
        if s.get("shadow"):
            # `f` is a gray multiply factor: 0 = untouched, v>0 = floor x v/255
            # (measured against the painted room). As RGBA: black, alpha 255 - v.
            sw, sh_, rows = decode_png(base64.b64decode(s["shadow"]["f"].split(",", 1)[1]))
            out = [bytearray(b"".join(bytes([0, 0, 0, 0 if r[x * 4] == 0 else 255 - r[x * 4]]) for x in range(sw))) for r in rows]
            encode_png(os.path.join(dest, f"shadow_{n}.png"), sw, sh_, out)
            p["shadow"] = {"x": s["shadow"]["x"], "y": s["shadow"]["y"]}
        pieces.append(p)
    print(json.dumps({"w": data["w"], "h": data["h"], "pieces": pieces}, indent=1))


if __name__ == "__main__":
    kind, ident, dest = sys.argv[1:4]
    {"tileset": tileset, "object": obj, "character": character, "objanim": object_anim, "frames": image_frames, "room": room}[kind](ident, dest)
