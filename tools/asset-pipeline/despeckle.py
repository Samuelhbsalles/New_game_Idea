"""Remove stray specks from creature frames (stdlib only).

Usage:
  python -I tools/asset-pipeline/despeckle.py <max_neighbours> <frame.png> [<frame.png> ...]
  python -I tools/asset-pipeline/despeckle.py --halo <frame.png> [<frame.png> ...]

AI animation frames sometimes carry a few loose pixels floating around the
sprite (seen on the chameleon's side walk). An opaque pixel with at most
<max_neighbours> opaque pixels among its 8 neighbours is made transparent.
1 removes lone dots and pairs; the sprite's own outline always has more.
Prints how many pixels each file lost; observations only.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixellab_fetch import decode_png, encode_png  # noqa: E402

OPAQUE = 128


def despeckle(path, max_n):
    with open(path, "rb") as f:
        w, h, rows = decode_png(f.read())

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h and rows[y][x * 4 + 3] > OPAQUE

    loose = []
    for y in range(h):
        for x in range(w):
            if not solid(x, y):
                continue
            n = sum(solid(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
            if n <= max_n:
                loose.append((x, y))
    for x, y in loose:
        rows[y][x * 4:x * 4 + 4] = b"\x00\x00\x00\x00"
    if loose:
        encode_png(path, w, h, rows)
    print(os.path.basename(path), len(loose))


def dehalo(path, passes=2, light=200):
    """Clears near-white pixels that touch transparency (a white halo hugging the outline)."""
    with open(path, "rb") as f:
        w, h, rows = decode_png(f.read())
    total = 0
    for _ in range(passes):
        clear = []
        for y in range(h):
            for x in range(w):
                o = x * 4
                r, g, b, a = rows[y][o:o + 4]
                if a <= OPAQUE or min(r, g, b) < light:
                    continue
                edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or rows[y + dy][(x + dx) * 4 + 3] <= OPAQUE for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    clear.append((x, y))
        for x, y in clear:
            rows[y][x * 4:x * 4 + 4] = b"\x00\x00\x00\x00"
        total += len(clear)
    if total:
        encode_png(path, w, h, rows)
    print(os.path.basename(path), "halo", total)


def main():
    if sys.argv[1] == "--halo":
        for p in sys.argv[2:]:
            dehalo(p)
        return
    max_n = int(sys.argv[1])
    for p in sys.argv[2:]:
        despeckle(p, max_n)


if __name__ == "__main__":
    main()
