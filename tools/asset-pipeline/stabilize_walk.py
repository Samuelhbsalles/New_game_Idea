"""Stop the creator's walk cycle from wobbling sideways.

Usage:
  python -I tools/asset-pipeline/stabilize_walk.py <creator_root> [base_layer]

PixelLab's walk template moves the whole figure a pixel or two left/right
between frames, which reads as a jittery walk. For every walk frame this
measures the horizontal centre of the torso (rows TORSO_ROWS) on the base
body (default body_m), compares it with the same facing's idle frame, and
shifts that frame of EVERY layer by the same amount so all layers stay
aligned with each other. Running it again finds nothing left to shift.

Prints the shift applied per frame; observations only.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from extract_layer import shifted  # noqa: E402
from pixellab_fetch import decode_png, encode_png  # noqa: E402

TORSO_ROWS = (18, 30)


def torso_x(rows, w):
    xs = [x for y in range(TORSO_ROWS[0], TORSO_ROWS[1] + 1) for x in range(w) if rows[y][x * 4 + 3]]
    return sum(xs) / len(xs) if xs else w / 2


def main():
    root = sys.argv[1]
    base = sys.argv[2] if len(sys.argv) > 2 else "body_m"
    layers = [d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))]
    report = {}
    for d in ("down", "up", "right"):
        w, h, idle = decode_png(open(os.path.join(root, base, f"{base}_idle_{d}_01.png"), "rb").read())
        ref = torso_x(idle, w)
        for n in range(1, 5):
            _, _, frame = decode_png(open(os.path.join(root, base, f"{base}_walk_{d}_{n:02d}.png"), "rb").read())
            dx = round(ref - torso_x(frame, w))
            report[f"{d}_{n}"] = dx
            if dx == 0:
                continue
            for layer in layers:
                p = os.path.join(root, layer, f"{layer}_walk_{d}_{n:02d}.png")
                if os.path.exists(p):
                    lw, lh, rows = decode_png(open(p, "rb").read())
                    encode_png(p, lw, lh, shifted(rows, lw, lh, dx, 0))
    print(json.dumps(report))


if __name__ == "__main__":
    main()
