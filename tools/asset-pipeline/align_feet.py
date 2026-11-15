"""Put a creature's walk frames on the same ground line as its idle pose (stdlib only).

Usage:
  python -I tools/asset-pipeline/align_feet.py <species_dir> [<species_dir> ...]

PixelLab walks made on a separate "Standing" state often stand a few pixels
higher than the idle (sitting) pose, so the creature visibly lifts off the
ground when it starts walking. For each walk direction this shifts ALL its
frames by one shared vertical offset, so the lowest foot of the clip lands on
the idle pose's lowest row for that direction. Bounces inside the clip are kept.
Prints what it moved; observations only.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from pixellab_fetch import decode_png, encode_png  # noqa: E402

ACTIONS = ("walk",)
OPAQUE = 128


def feet(rows, w):
    """Lowest row with an opaque pixel, or -1 for an empty frame."""
    for y in range(len(rows) - 1, -1, -1):
        if any(rows[y][x * 4 + 3] > OPAQUE for x in range(w)):
            return y
    return -1


def shift(rows, w, dy):
    """Moves the image dy rows down (negative = up), transparent fill."""
    h = len(rows)
    out = [bytearray(w * 4) for _ in range(h)]
    for y in range(h):
        ty = y + dy
        if 0 <= ty < h:
            out[ty] = bytearray(rows[y])
    return out


def align(species_dir):
    d = Path(species_dir)
    sp = d.name
    report = {}
    for action in ACTIONS:
        for direction in ("down", "up", "right"):
            idle = d / f"{sp}_idle_{direction}_01.png"
            frames = sorted(d.glob(f"{sp}_{action}_{direction}_*.png"))
            if not idle.exists() or not frames:
                continue
            w, _, irows = decode_png(idle.read_bytes())
            ground = feet(irows, w)
            decoded = [decode_png(f.read_bytes()) for f in frames]
            low = max(feet(r, fw) for fw, _, r in decoded)
            dy = ground - low
            if ground < 0 or low < 0 or dy == 0:
                continue
            for f, (fw, fh, r) in zip(frames, decoded):
                encode_png(str(f), fw, fh, shift(r, fw, dy))
            report[f"{action}_{direction}"] = dy
    print(sp, report or "already aligned")


def main():
    for p in sys.argv[1:]:
        align(p)


if __name__ == "__main__":
    main()
