"""Install a PixelLab creature into public/assets/creatures/<species>/ (stdlib only).

Usage:
  python -I tools/asset-pipeline/install_creature.py <spec.json> <species> [<species> ...]

The spec (tools/asset-pipeline/creature_art.json) says, per species, which
PixelLab character group to download and which of its animations become which
game action:

  "dog": {
    "char": "<character id of any state in the group>",
    "idle": "Idle",                                  # state whose rotations are the idle frames
    "anims": [
      {"action": "walk", "state": "Standing", "name": "walk"},
      {"action": "sleep", "state": "Idle", "name": "sleep", "frames": [6, 8]}
    ]
  }

`frames` is an inclusive [first, last] range of the stored frames. Left out,
custom v3 clips (9 frames: the reference pose + 8) drop the reference pose
and template clips keep all of theirs. Directions map south/north/east/west to
down/up/right/left; the game mirrors right for left, so west is only used for idle.

Frames are written as <species>_<action>_<dir>_NN.png (01-based), flat-colour
backgrounds are keyed out, and everything is put on a 48x48 canvas (the size the
existing creatures use). Prints what it wrote; observations only.
"""
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(__file__))
from pixellab_fetch import API, decode_png, encode_png, fetch, key_out_background  # noqa: E402
import align_feet  # noqa: E402  (walk frames onto the idle ground line)

DIRS = {"south": "down", "north": "up", "east": "right", "west": "left"}
SIZE = 48
OUT_ROOT = os.path.join("public", "assets", "creatures")


def fit(w, h, rows, size=SIZE):
    """Pad or centre-crop to size x size (same rule as normalize_canvas.py)."""
    if (w, h) == (size, size):
        return rows
    ox, oy = (size - w) // 2, (size - h) // 2
    out = [bytearray(size * 4) for _ in range(size)]
    for y in range(h):
        ty = y + oy
        if 0 <= ty < size:
            for x in range(w):
                tx = x + ox
                if 0 <= tx < size:
                    out[ty][tx * 4:tx * 4 + 4] = rows[y][x * 4:x * 4 + 4]
    return out


def write_frame(png_bytes, path):
    """Keys out an opaque flat background, fits to 48x48, writes. Returns keyed pixel count."""
    w, h, rows = decode_png(png_bytes)
    keyed = 0
    corners = [rows[0][3], rows[0][(w - 1) * 4 + 3], rows[h - 1][3], rows[h - 1][(w - 1) * 4 + 3]]
    if all(a == 255 for a in corners):
        keyed = key_out_background(w, h, rows)
    encode_png(path, SIZE, SIZE, fit(w, h, rows))
    return keyed


def install(species, spec):
    z = zipfile.ZipFile(io.BytesIO(fetch(f"{API}/characters/{spec['char']}/download")))
    meta = json.loads(z.read("metadata.json"))
    states = {s["character"]["name"]: s for s in meta["states"]}
    out = os.path.join(OUT_ROOT, species)
    os.makedirs(out, exist_ok=True)
    report = {"species": species, "written": {}, "keyed_px": 0}

    idle = states[spec.get("idle", "Idle")]["frames"]["rotations"]
    for d, path in idle.items():
        if d in DIRS:
            report["keyed_px"] += write_frame(z.read(path), os.path.join(out, f"{species}_idle_{DIRS[d]}_01.png"))

    for a in spec["anims"]:
        clips = states[a["state"]]["frames"]["animations"][a["name"]]
        for d, paths in clips.items():
            if d not in DIRS or d == "west":
                continue
            if "frames" in a:
                lo, hi = a["frames"]
                pick = paths[lo:hi + 1]
            else:
                pick = paths[1:] if len(paths) % 2 == 1 else paths
            for i, p in enumerate(pick, 1):
                report["keyed_px"] += write_frame(z.read(p), os.path.join(out, f"{species}_{a['action']}_{DIRS[d]}_{i:02d}.png"))
            report["written"][f"{a['action']}_{DIRS[d]}"] = len(pick)
    print(json.dumps(report))
    align_feet.align(out)


def main():
    spec_path, names = sys.argv[1], sys.argv[2:]
    spec = json.load(open(spec_path, encoding="utf-8"))
    for n in names:
        install(n, spec[n])


if __name__ == "__main__":
    main()
