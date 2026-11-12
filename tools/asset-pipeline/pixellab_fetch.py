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


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "asset-pipeline"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


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


def obj(oid, out):
    w, h, rows = decode_png(fetch(f"{API}/map-objects/{oid}/download"))
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
            d = DIRS.get(parts[i + 2])
            if d and d != "left":
                k = int(parts[-1][6:9]) + 1
                open(f"{dest}_walk_{d}_{k:02d}.png", "wb").write(z.read(n))
                counts[d] = max(counts.get(d, 0), k)
    print(json.dumps({"walkFrames": counts}))


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


if __name__ == "__main__":
    kind, ident, dest = sys.argv[1:4]
    {"tileset": tileset, "object": obj, "character": character, "objanim": object_anim, "frames": image_frames}[kind](ident, dest)
