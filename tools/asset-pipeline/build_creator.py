"""Build the character-creator layers from PixelLab edit jobs.

Usage:
  python -I tools/asset-pipeline/build_creator.py <jobs.json> <base_dir> <out_root>

jobs.json maps a layer key to an edit_image job id made on the 16 base frames
(4 idle facings, then walk down/up/right x4), e.g. {"hair_long": "6fd1..."}.
A key starting with "body_" is a whole body: its frames are aligned to the
base and kept whole. Any other key is an overlay: aligned, diffed against the
base and cleaned (extract_layer.py).

Writes <out_root>/<key>/<key>_<idle|walk>_<dir>_<NN>.png, the same naming the
game's character loader uses, plus the base itself as body_m.
Prints per-layer pixel counts; observations only.
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(__file__))
from extract_layer import best_shift, drop_specks, shifted, MIN_CLUSTER  # noqa: E402
from pixellab_fetch import API, decode_png, encode_png, fetch  # noqa: E402

ORDER = [("idle", d, 1) for d in ("down", "up", "right", "left")] + [("walk", d, i) for d in ("down", "up", "right") for i in range(1, 5)]
THRESHOLD = 60
# Rows (48px canvas, measured on the v3 base) where the base tee and shorts live.
# The eyes sit above row 17 and the socks below row 38, so neither is swallowed.
TEE_ROWS = (18, 33)
SHORTS_ROWS = (28, 39)


def garment_covers(key, b, y):
    """True when base pixel b at row y belongs to the base garment that `key` replaces."""
    if not b[3] or max(b[:3]) - min(b[:3]) >= 24:
        return False
    l = 0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2]
    if key.startswith("top_"):
        return TEE_ROWS[0] <= y <= TEE_ROWS[1] and l >= 150
    if key.startswith("bottom_"):
        return SHORTS_ROWS[0] <= y <= SHORTS_ROWS[1] and 50 <= l < 150
    return False


# Lowest row (48px canvas) hair can reach: long hair ends around the shoulder blades.
HAIR_MAX_ROW = 36
# First row of the face (brows) on the v3 base; above it, skin-like hair pixels are
# light hair highlights over the scalp and must stay.
FACE_TOP_ROW = 11


# How far (px) to look left and right of a pixel for face skin.
EYE_REACH = 3


def is_skin(p):
    """Same rule as src/logic/appearance.ts isSkin."""
    r, g, b, a = p
    return a and r >= 150 and r > g >= b and 12 <= r - b <= 140


def is_eye(base, x, y, w):
    """A non-skin base pixel with face skin on both sides within EYE_REACH."""
    p = base[y][x * 4:x * 4 + 4]
    if not p[3] or is_skin(p):
        return False
    left = any(is_skin(base[y][(x - k) * 4:(x - k) * 4 + 4]) for k in range(1, EYE_REACH + 1) if x - k >= 0)
    right = any(is_skin(base[y][(x + k) * 4:(x + k) * 4 + 4]) for k in range(1, EYE_REACH + 1) if x + k < w)
    return left and right


def base_name(action, d, i):
    return f"base_m_{action}_{d}_{i:02d}.png"


def out_name(key, action, d, i):
    return f"{key}_{action}_{d}_{i:02d}.png"


def main():
    jobs = json.load(open(sys.argv[1]))
    base_dir, out_root = sys.argv[2], sys.argv[3]
    os.makedirs(os.path.join(out_root, "body_m"), exist_ok=True)
    for a, d, i in ORDER:
        shutil.copy(os.path.join(base_dir, base_name(a, d, i)), os.path.join(out_root, "body_m", out_name("body_m", a, d, i)))
    report = {}
    for key, job in jobs.items():
        os.makedirs(os.path.join(out_root, key), exist_ok=True)
        counts = []
        for k, (a, d, i) in enumerate(ORDER):
            w, h, base = decode_png(open(os.path.join(base_dir, base_name(a, d, i)), "rb").read())
            _, _, edited = decode_png(fetch(f"{API}/images/{job}/download?index={k}"))
            dx, dy = best_shift(base, edited, w, h)
            edited = shifted(edited, w, h, dx, dy)
            if key.startswith("body_"):
                rows = edited
            else:
                rows = []
                for y in range(h):
                    row = bytearray(w * 4)
                    for x in range(w):
                        b, e = base[y][x * 4:x * 4 + 4], edited[y][x * 4:x * 4 + 4]
                        if not e[3]:
                            continue
                        # A garment covers the whole base garment it replaces, even where the
                        # light grey edit is close to the white tee / grey shorts in colour;
                        # otherwise the recoloured garment shows white holes.
                        covers = garment_covers(key, b, y)
                        if not covers and b[3] and abs(b[0] - e[0]) + abs(b[1] - e[1]) + abs(b[2] - e[2]) <= THRESHOLD:
                            continue
                        # Hair edits redraw the eyes too. Where the base has a non-skin pixel
                        # with skin on both sides (an eye in the middle of the face), keep the
                        # body's own pixel so recolouring the hair never recolours the eyes.
                        # Long hair over the shirt is unaffected: its neighbours are shirt.
                        if key.startswith("hair_") and is_eye(base, x, y, w):
                            continue
                        # Detailed (v3) edits redraw the whole face: skin-coloured pixels in a
                        # hair edit are that redrawn face, not hair, and nothing below the
                        # shoulders is hair (it is redraw noise, e.g. on the shoes).
                        if key.startswith("hair_") and ((is_skin(e) and y >= FACE_TOP_ROW) or y > HAIR_MAX_ROW):
                            continue
                        row[x * 4:x * 4 + 4] = e
                    rows.append(row)
                drop_specks(rows, w, h, MIN_CLUSTER)
            encode_png(os.path.join(out_root, key, out_name(key, a, d, i)), w, h, rows)
            counts.append(sum(1 for r in rows for x in range(w) if r[x * 4 + 3]))
        report[key] = {"min_px": min(counts), "max_px": max(counts)}
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
