"""Put every PNG in a folder on the same square canvas, centred.

Usage:
  python -I tools/asset-pipeline/normalize_canvas.py <folder> <size>

PixelLab stores a character's rotations at its own size (e.g. 48x48) but
v3 animations on a larger canvas with room to move (60x60, 64x64). Drawn
with a centred origin, mixed sizes make the creature jump when it switches
between standing and walking. This pads (or, if larger, centre-crops) each
frame to size x size around its centre. Running it twice changes nothing.

Prints how many files changed size; observations only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixellab_fetch import decode_png, encode_png  # noqa: E402


def main():
    folder, size = sys.argv[1], int(sys.argv[2])
    changed = 0
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".png"):
            continue
        p = os.path.join(folder, name)
        w, h, rows = decode_png(open(p, "rb").read())
        if (w, h) == (size, size):
            continue
        ox, oy = (size - w) // 2, (size - h) // 2
        out = [bytearray(size * 4) for _ in range(size)]
        for y in range(h):
            ty = y + oy
            if not 0 <= ty < size:
                continue
            for x in range(w):
                tx = x + ox
                if 0 <= tx < size:
                    out[ty][tx * 4:tx * 4 + 4] = rows[y][x * 4:x * 4 + 4]
        encode_png(p, size, size, out)
        changed += 1
    print(f"{changed} file(s) put on a {size}x{size} canvas")


if __name__ == "__main__":
    main()
