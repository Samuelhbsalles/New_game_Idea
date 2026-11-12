"""Extract a paper-doll layer (hair, top, pants...) by diffing dressed frames against the base body.

Usage:
  python -I tools/asset-pipeline/extract_layer.py <base_dir> <dressed_dir> <out_dir> [threshold]

Each PNG in <dressed_dir> is matched by file name to the same PNG in <base_dir>
(same pose, same canvas). A pixel goes into the layer when the dressed frame
differs from the base there by more than `threshold` (sum of RGB differences,
default 60) or when the base is transparent and the dressed frame is not.
Everything else is transparent, so the layer can be drawn over the base.

Prints, per frame, how many pixels went into the layer and how many base
pixels the dressed frame erased (those cannot be represented by an overlay).
Observations only: it does not judge whether the layer looks right.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixellab_fetch import decode_png, encode_png  # noqa: E402


def best_shift(base, dressed, w, h, reach=8):
    """The (dx, dy) that moves `dressed` onto `base` with the most matching
    opaque pixels in the lower half (the body below the head), since AI edits
    may redraw the whole sprite a few pixels off."""
    best, best_score = (0, 0), -1
    for dy in range(-reach, reach + 1):
        for dx in range(-reach, reach + 1):
            score = 0
            for y in range(h // 2, h):
                sy = y - dy
                if not 0 <= sy < h:
                    continue
                for x in range(w):
                    sx = x - dx
                    if not 0 <= sx < w:
                        continue
                    b = base[y][x * 4:x * 4 + 4]
                    d = dressed[sy][sx * 4:sx * 4 + 4]
                    if b[3] and d[3] and abs(b[0] - d[0]) + abs(b[1] - d[1]) + abs(b[2] - d[2]) < 40:
                        score += 1
            if score > best_score:
                best, best_score = (dx, dy), score
    return best


def shifted(img, w, h, dx, dy):
    out = [bytearray(w * 4) for _ in range(h)]
    for y in range(h):
        sy = y - dy
        if 0 <= sy < h:
            for x in range(w):
                sx = x - dx
                if 0 <= sx < w:
                    out[y][x * 4:x * 4 + 4] = img[sy][sx * 4:sx * 4 + 4]
    return out


def extract(base_path, dressed_path, out_path, threshold):
    bw, bh, base = decode_png(open(base_path, "rb").read())
    dw, dh, dressed = decode_png(open(dressed_path, "rb").read())
    assert (bw, bh) == (dw, dh), f"size mismatch {base_path} {bw}x{bh} vs {dw}x{dh}"
    dx, dy = best_shift(base, dressed, bw, bh)
    dressed = shifted(dressed, bw, bh, dx, dy)
    rows, kept, erased = [], 0, 0
    for y in range(bh):
        out = bytearray(bw * 4)
        for x in range(bw):
            b = base[y][x * 4:x * 4 + 4]
            d = dressed[y][x * 4:x * 4 + 4]
            if d[3] == 0:
                if b[3] != 0:
                    erased += 1
                continue
            diff = abs(b[0] - d[0]) + abs(b[1] - d[1]) + abs(b[2] - d[2])
            if b[3] == 0 or diff > threshold:
                out[x * 4:x * 4 + 4] = d
                kept += 1
        rows.append(out)
    dropped = drop_specks(rows, bw, bh, MIN_CLUSTER)
    encode_png(out_path, bw, bh, rows)
    return kept - dropped, erased


# Clusters of fewer opaque pixels than this are redraw noise, not part of the item.
MIN_CLUSTER = 8


def drop_specks(rows, w, h, min_size):
    """Clears 8-connected clusters smaller than min_size; returns pixels cleared."""
    seen = [[False] * w for _ in range(h)]
    cleared = 0
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or not rows[y0][x0 * 4 + 3]:
                continue
            stack, cluster = [(x0, y0)], []
            seen[y0][x0] = True
            while stack:
                x, y = stack.pop()
                cluster.append((x, y))
                for ny in (y - 1, y, y + 1):
                    for nx in (x - 1, x, x + 1):
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and rows[ny][nx * 4 + 3]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            if len(cluster) < min_size:
                for x, y in cluster:
                    rows[y][x * 4:x * 4 + 4] = b"\x00\x00\x00\x00"
                cleared += len(cluster)
    return cleared


def main():
    base_dir, dressed_dir, out_dir = sys.argv[1:4]
    threshold = int(sys.argv[4]) if len(sys.argv) > 4 else 60
    os.makedirs(out_dir, exist_ok=True)
    report = {}
    for name in sorted(os.listdir(dressed_dir)):
        if not name.endswith(".png"):
            continue
        base = os.path.join(base_dir, name)
        if not os.path.exists(base):
            report[name] = "no base frame"
            continue
        kept, erased = extract(base, os.path.join(dressed_dir, name), os.path.join(out_dir, name), threshold)
        report[name] = {"layer_px": kept, "erased_base_px": erased}
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
