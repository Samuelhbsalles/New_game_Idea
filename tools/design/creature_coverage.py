"""Coverage report: which creatures are good (>1x) and bad (<1x) at each workplace.

Usage:
  python -I tools/design/creature_coverage.py

Reads src/data/creatures.json and src/data/shops.json. Observations only:
it lists counts and names; deciding whether a workplace is short of good
creatures is design's call (design/creatures.md, "Cobertura por comércio").
"""
import json

species = json.load(open("src/data/creatures.json", encoding="utf-8"))
shops = [s["id"] for s in json.load(open("src/data/shops.json", encoding="utf-8"))]
for shop in shops:
    strong = sorted((s for s in species if s["affinities"].get(shop, 1) > 1), key=lambda s: -s["affinities"][shop])
    weak = [s for s in species if s["affinities"].get(shop, 1) < 1]
    fmt = lambda xs: ", ".join(f"{s['id']} {s['affinities'][shop]}x ({s['rarity']})" for s in xs) or "-"
    print(f"{shop:12} strong {len(strong)}: {fmt(strong)}")
    print(f"{'':12} weak   {len(weak)}: {fmt(weak)}")
