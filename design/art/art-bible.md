# Art Bible: Creature Game

> **Status**: Draft
> **Owned By**: art-director
> **Last Updated**: 2026-11-04
> **Art Director Sign-Off (AD-ART-BIBLE)**: SKIPPED 2026-11-04 — solo mode

`/art-bible` writes these nine sections in this order and replaces each
section's `[To be designed]` line as that section is approved. A section still
holding its placeholder is incomplete; a later run fills only those.

## 1. Visual Identity Statement

- **Rule:** *"Readable in a glance, warm on a second look."* In two seconds the player sees who is working, what is ready and what is missing. Charm is layered on only after that holds.
- **Silhouette Is the Species** (Pillar: Collection)
  - Each species is recognisable from its filled silhouette alone at 32x32. Variants change only the palette or one small accessory, never the outline, so the album's silhouettes stay honest.
  - *Test:* when a design choice is unclear, pick the detail that changes the outline over one that adds interior pixels.
- **Work Shows on the Body** (Pillar: Working creatures)
  - Each shop gets a pose, prop or palette accent on the creature (flour dust at the bakery, a hard hat at construction). A tired creature curls up asleep. It never looks sick, hurt or sad.
  - *Test:* when unsure whether to show state with a HUD icon or the sprite, use the sprite. Use an icon only if the sprite can't carry it at 32px.
- **Districts Whisper, Creatures Speak** (Pillar: City progression)
  - Each district has a narrow, low-contrast palette. Creatures always sit higher in saturation and value contrast. Better cities get a richer palette, never a darker or harsher one.
  - *Test:* when a tile competes with a creature for attention, desaturate the tile.
- **Open:** Social has no principle yet (the prototype is solo). Later it needs one about telling your own creatures apart from other players'.
- **Guardrail:** top-down only, never isometric. Inspirations (Pokémon, Habbo, Stardew Valley) inform feel, not look.

## 2. Mood & Atmosphere

**Global rules**
- Each state is set apart by **dominant hue + value key + light source**. No two states share all three (matrix below).
- Mood lives in the environment and UI layers. Creatures stay identical in every state.
- Energy ceiling for the whole game: medium. Nothing frantic, nothing urgent.

**District / catching (prototype: Park)**
- Target: gentle curiosity. "Something might be in that bush."
- Lighting: open daylight driven by time of day. Low contrast, soft shadows under trees and props only. Neutral-cool by day, warm at golden hour.
- Descriptors: airy, open, rustling, inviting. Energy: medium-low.
- Carriers: grass and leaf sway (2–3 frame loops), a bush rustles before a creature reveals itself, a soft cream glow ring around placed bait.
- Catch: the environment desaturates about 20% around the target. On success, a short Coin Gold sparkle and small pop, no fanfare.

**Shop, creatures working (prototype: Bakery)**
- Target: satisfied busyness. "A warm kitchen running itself."
- Lighting: **interior follows time of day** (same tint steps as the district, applied to the interior tiles). The oven glow is a constant warm key light that is never tinted, so the bakery stays warmer than the street at every hour.
- Descriptors: bustling, warm, floury, purposeful. Energy: medium (highest steady).
- Carriers: oven glow pulse, flour puffs, per-creature work loops, and a shelf that fills with bread so progress shows in the scene, not only the HUD.
- Trade-off accepted: the interior shares the time-of-day light with districts. The oven key and the toasted-tan palette keep it distinct.

**Collecting goods (moment in the shop)**
- Target: small, frequent pleasure. "Ding, it's done."
- Lighting: inherits the shop. Carried by the badge and VFX only.
- Descriptors: bright, bouncy, quick, tidy. Energy: a spike under 0.5 s, then back to baseline.
- Carriers: the ready badge bounces, goods arc to inventory, the coin counter ticks up.

**Home, resting and eating (prototype: Home apartment)**
- Target: safe contentment. "Everyone's home."
- Lighting: warmest, lowest contrast. Lamp pools, evening bias even by day (curtains filter the window).
- Descriptors: snug, quiet, soft, settled. Energy: lowest in the game.
- Carriers: creatures curled asleep (the roundest silhouettes), a slow "Zzz" bob (one cycle per 2 s or slower), food bowls, Hearth Orange lamp pools on a muted floor.

**Album**
- Target: quiet pride plus a pull to complete it. "Look what I've found, and what's still out there."
- Lighting: none. Flat paper, no tint.
- Descriptors: tidy, archival, proud, curious. Energy: low.
- Carriers: Paper Cream page grid. Caught entries in full colour. Uncaught entries are flat Ink Plum silhouettes with "?". A new catch stamps in with a small thud.

**Market / shop menus (sell goods, buy bait and food)**
- Target: friendly, fast transaction. "Clear prices, quick decision."
- Lighting: none. Flat, bright, highest legibility.
- Descriptors: bright, clear, chirpy, quick. Energy: medium.
- Carriers: striped awning header, Coin Gold price tags, coin tick-up, item icons on cream cards.

**Distinctness matrix**

| State | Dominant hue | Value key | Light source |
|---|---|---|---|
| District / park | Sage greens | Mid, low contrast | Sky (time of day) |
| Bakery | Toasted tans + orange glow | Mid-high | Time of day + constant oven key |
| Collecting | Inherits bakery + gold accent | Spike | Badge VFX |
| Home | Rose-wood + lamp orange | Mid-low, softest | Lamps |
| Album | Paper Cream + plum | High, flat | None |
| Market UI | Cream + gold + awning stripe | High, flat | None |

**Day/night and weather (readability-safe)**
- Tint applies only to the tilemap and decor layers. Creatures, interactable outlines and UI render untinted. Creatures may take at most 10% tint so they sit in the scene.
- Dawn: `#F2C7A5` multiply at 20%. Day: none. Dusk: `#E0A07A` multiply at 25%. Night: `#6F6A9E` multiply at 35%.
- **Night floor:** environment lightness never below 30% L, so the Ink Plum outline (about 20% L) still separates creatures.
- Night: windows and lamps add Hearth Orange pools (additive, 20–30% alpha). Night reads cozy, not dark.
- Rain: environment saturation −15%, a slight cool shift, raindrop overlay. Fog: lifts values, never darkens.
- No weather or time state pushes the environment darker than the night tint.

## 3. Shape Language

**Hierarchy (figure/ground)**
- Hero (creatures): round, organic, curved. Plum outline.
- Interactables (bait, oven, bowls, ready goods, doors): soft rectangles, plum outline on the outer edge only.
- Supporting (tiles, decor): grid-aligned rectangles, 1–2 px corner rounding. No plum outline; edges use a darker shade of the same hue.
- **Rule: a plum outline means "alive or interactive."** Decor never gets one.
- Serves: Section 1 "Districts Whisper, Creatures Speak". Pillars: Collection, City progression. The eye goes to creatures, then interactables, then the world.

**Creature silhouettes**
- Base mass: one rounded "loaf/bean" body. **One signature trait per species** reaches the silhouette edge with at least 3 px protrusion:
  - Rabbit: tall ears
  - Pigeon: puffed chest, small head, tail fan
  - Cat: triangle ears and a curled tail
  - Monkey: long arms and a curled tail
  - Fire dragon: wing nubs and a flame-tip tail
  - Stone golem: blocky, angular mass (the only creature allowed hard corners)
- Animal-true, not Pokémon-like proportions:
  - Head at most 40% of sprite height.
  - Eyes are 1–2 px dots, with no anime highlights or oversized irises.
  - Real anatomical cues stay (rabbit haunches, pigeon legs, monkey arm length).
  - No chibi head-on-tiny-body.
- Charm comes from pose and accessory, not inflated proportions.
- Size caps (Pixellab constraints):
  - Canvas 32x32, transparent.
  - Body bounding box at most 28x28 with at least 2 px margin.
  - Smallest species (pigeon) at least 16 px tall.
  - Golem may use up to 30 px.
- View: top-down, 3/4 front-facing characters. Never isometric, no diagonal ground plane.
- Test: the filled black silhouette at 32x32 is identifiable with no interior pixels.
- Serves: Section 1 "Silhouette Is the Species". Pillar: Collection.

**Variants vs work states**
- Variants: palette swap or one accessory of at most 6x6 px, staying inside the silhouette or extending at most 1 px. Never an outline change.
- Work states may change the outline. The silhouette grammar holds without colour:
  - Working: upright, asymmetric, prop extends the outline (rolling pin, hard hat, tray).
  - Tired: curled into a near-circle, no prop, no trait protrusion except ears or tail tip.
  - Ready to collect: goods icon bouncing above the creature or station.
  - Idle: upright, symmetric, no prop.
- Never droop, limp or slump. Rest is a circle, not a collapse.
- Serves: Section 1 "Work Shows on the Body". Pillar: Working creatures.

**Environment geometry**
- 32x32 grid-locked modules. Walls, counters and paths align to the tile grid.
- Corners rounded 1–2 px everywhere. No spikes, no jagged edges.
- Low interior detail: at most 3 values per tile, and no tile pattern busier than creature interior pixels.
- Districts are told apart by material shape motif:
  - Park: blobby canopies
  - Bakery: arched oven, loaf-shaped shelves
  - Home: soft rugs and pillows
  - Downtown: tall narrow rectangles
  - Rooftops: chimneys and antennas
  - Subway/sewer: pipe curves and tile grids
  - Port: crates and rope coils
  - Industrial: wide rectangles and gears
  - Old quarter: arches and cobbles
  - Rural outskirts: fences and haystacks
- City progression adds shapes (awnings, planters, bunting) and never removes softness.
- Serves: Pillar City progression, and Section 1 "Districts Whisper". The world is a stable, safe stage.

**UI shape grammar: echoes the world, stands apart in lighting**
- Echo: same pixel grid, same Ink Plum outline language, same soft corners.
- Stand apart: flat (no lighting, no time or weather tint), on a Paper Cream base that no district uses as a fill.
- Panels: rounded rectangle, 4 px corner radius at 1x, 2 px plum border, cream fill, 1 px darker-cream inner shade at the bottom edge.
- Buttons: "loaf" shape, a rounded rectangle 2 px taller at the top edge, 1 px pressed offset.
- State badges, one unique shape per state so state reads without colour:
  - Ready: circle with the goods icon inside
  - Working: circle with a progress ring around it
  - Tired: crescent moon with "z"
  - Missing / needs you: speech bubble with "!"
  - Uncaught: "?" on a silhouette
- Icons 16x16, same outline rule as creatures.
- Mobile: minimum tap target 44x44 CSS px. Badges at least 12 px rendered and can scale up. Creature sprites are never scaled below 1x.
- Serves: Section 1 "Readable in a glance". Feels friendly and tactile, like a paper scrapbook laid over the city.

## 4. Color System

**Primary palette (7). The world anchor, given to Pixellab as-is.**

| # | Name | Hex | Role and meaning in this world |
|---|---|---|---|
| 1 | Ink Plum | `#3B2A3F` | Universal outline, darkest value. Means "alive or interactive". Also the uncaught silhouette, UI text and the "needs you" mark. Warm dark, never pure black. |
| 2 | Paper Cream | `#F4E9D3` | Highlight value, UI panel base, album paper. Never a district fill. |
| 3 | Hearth Orange | `#E07A3C` | Warmth: home lamps, oven glow, warm creature accents. Means "comfort". |
| 4 | Meadow Sage | `#8DAA78` | Nature anchor, park base. Means "the outdoors is calm". |
| 5 | Coin Gold | `#F5C542` | **Reserved.** Reward: coins, ready to collect, catch sparkle. Means "something to take". |
| 6 | Shift Blue | `#3F86C6` | **Reserved (saturated).** Working. Means "busy, steady, fine". Calm, not urgent. |
| 7 | Dusk Lilac | `#A28FCF` | Tired and rest, and the night-tint family. Means "sleep is good". |

- **No extra UI colour.** "Needs you" is carried by shape and motion in Ink Plum, not by its own hue. Decided 2026-11-04: Nudge Coral was dropped to keep the palette at 7.
- **Reservation rule:** saturated Coin Gold and Shift Blue appear only on state badges, VFX and UI. District palettes may use neighbouring hues only at saturation 35% or less, so the semantic colours stay unique in any scene.

**Semantic usage**

| State | Colour | Why | Required non-colour backup |
|---|---|---|---|
| Ready to collect | Coin Gold | Same meaning as a coin ("gain"). One colour, one idea. | Circle badge with goods icon, 2-frame bounce |
| Working | Shift Blue | Blue reads "in progress, no action needed". | Progress ring, upright pose with prop |
| Tired / resting | Dusk Lilac | Sleep and evening association. Soft, not sad. | Crescent with "z" badge, curled circle silhouette |
| Needs you (no worker, hungry, out of bait, storage full) | Ink Plum "!" on a cream bubble | Neutral nudge, no alarm colour. Covers the "what is missing" part of Section 1's rule. | Speech-bubble shape, one gentle nudge every 3 s, no flashing |
| Uncaught (album) | Ink Plum flat fill | Silhouette-only teaser (Pillar: Collection) | "?" mark, no interior pixels |
| Coins / reward | Coin Gold | Shared with Ready on purpose | Coin disc shape vs goods-in-circle shape |
| Danger | none | Nothing in the game is dangerous. A red would imply threat. | n/a |

- All badges are a cream disc or bubble with a 2 px plum ring. The semantic colour is the icon or fill, which keeps contrast on any district background.
- The two-second rule: blue for working, gold for ready. "Missing" is the only state without a hue, so its bubble shape and nudge motion must stay distinct from every other badge.
- **Trade-off accepted:** without a colour, "needs you" is weaker at a glance. If playtests show players miss it, revisit adding a UI-only hue.

**Creature colour constraints (Pixellab)**
- At most 5 colours per sprite, including the Ink Plum outline.
- 1 px Ink Plum outline, external only. Interior separations use darker same-hue shades.
- The creature's main hue is at least 20 saturation points above the highest saturation in the district palette.
- Full value range: outline about 20% L to highlight at 80% L or more.
- Species base colours stay true to the animal (grey pigeon, brown rabbit), lifted in saturation. Fantasy species may base on one primary hue (dragon Hearth Orange; golem warm grey with a Sage moss accent).
- Shop accents are small and consistent per shop: flour (Paper Cream speckle) at the bakery, hard hat at construction (desaturated yellow, not Coin Gold).

**District palette rules**
- 4 base colours plus at most 2 accents per district. Values within 45–85% L. Saturation at most 35% at starting tier.
- City progression: each tier adds at most 1 accent hue (flowers, awnings, bunting) and raises the saturation cap 5 points, to a ceiling of 50%. The value floor never drops.
- Competition test: if a tile competes with a creature, desaturate the tile (Section 1).

| District | Temperature | Base set |
|---|---|---|
| Park (prototype) | Neutral-cool by day | `#8DAA78` `#A9C48F` `#C9D7A4`, path `#D9C9A3` |
| Bakery (prototype) | Warm | `#D8B48A` `#C99A6E` `#EBD3B0`, counter `#B5835C` |
| Home apartment (prototype) | Warmest, muted | `#C7A58E` `#B48C7A` `#E3CDB8`, rug `#A7A3B8` |
| Downtown | Neutral grey-blue | Desaturated slate and stone |
| Rooftops | Cool-airy | Pale sky lilac + terracotta chimneys |
| Subway / sewer | Cool | Teal-grey tile, lifted by warm lamp pools. Value floor 45% L. |
| Port | Cool-neutral | Blue-grey water and stone + rope tan. Water at saturation 35% or less (not Shift Blue). |
| Industrial | Warm-neutral | Khaki + muted rust (saturation 30% or less) |
| Old quarter | Warm | Terracotta + ochre cobbles. Ochre at saturation 30% or less (not Coin Gold). |
| Rural outskirts | Warm-light | Straw, wheat, pale sage |

**UI palette (diverges from the world)**
- Panel `#F4E9D3`, panel shade `#E3D3B5`, border and text `#3B2A3F`, disabled `#B9AE9C`. Semantic colours: Gold, Blue, Lilac.
- Market awning stripe: Hearth Orange and Paper Cream.
- Divergence: UI is flat and untinted, and uses Cream as a fill, which the world never does.
- Text contrast: Plum on Cream is about 12:1 (AA and AAA). Never put text on a semantic colour without a plum outline or cream backing.

**Colourblind safety: risky pairs**

| Pair | Fails for | Required backup |
|---|---|---|
| Working blue vs tired lilac | Protan / deutan (lilac collapses to blue) | Ring vs crescent badge. Upright-with-prop vs curled-circle silhouette. Ring animates its fill; tired has a slow bob. |
| Gold badge vs park sage | Deutan (low hue contrast) | Badges always on a cream disc with a plum ring. Never bare colour on a tile. |
| Gold vs blue | Generally safe (about 80% vs 55% L) | Value gap is enough; shape badges still apply. |

- Verification: run every state screen through greyscale plus protan, deutan and tritan simulation. Every state must be identifiable by badge shape and pose alone.
- Hex values are starting targets. Check them in the Phaser prototype against real 32x32 sprites before treating them as final.

## 5. Character Design Direction

[To be designed] — the player character's visual archetype, how players tell
enemies, NPCs and allies apart at a glance, expression and pose style, and how
much detail survives at game camera distance (LOD philosophy).

## 6. Environment Design Language

[To be designed] — architectural style and its tie to the world's culture,
texture philosophy (painted, PBR or stylised, and why), prop density rules per
area type, and environmental storytelling guidelines.

## 7. UI/HUD Visual Direction

[To be designed] — diegetic versus screen-space HUD, typography (personality,
weight, size hierarchy, minimum readable size), iconography style, UI animation
feel, and any art-direction versus readability conflict and how it was decided.

## 8. Asset Standards

[To be designed] — file formats, naming convention, texture resolution tiers,
LOD levels, export settings, and the engine's hard limits (poly budgets per
asset category, texture memory, material slots). Where an art preference and a
technical limit disagree, record both and the trade-off chosen.

## 9. Reference Direction

[To be designed] — 3–5 references (games, films, art styles or artists). For
each: the specific element to take from it, and what to avoid so the result
does not read as a copy.
