# Art Bible: Creature Game

> **Status**: Draft
> **Owned By**: art-director
> **Last Updated**: 2026-11-18 (revised for the cozy-magical hi-bit direction approved in playtest)
> **Art Director Sign-Off (AD-ART-BIBLE)**: SKIPPED 2026-11-04 — solo mode

`/art-bible` writes these nine sections in this order and replaces each
section's `[To be designed]` line as that section is approved. A section still
holding its placeholder is incomplete; a later run fills only those.

## 1. Visual Identity Statement

- **Rule:** *"Cozy-magical hi-bit, readable in a glance."* Rich, layered, softly glowing worlds with chibi characters in front. In two seconds the player sees who is working, what is ready and what is missing; wonder is layered on only after that holds.
- **Silhouette Is the Species** (Pillar: Collection)
  - Each species is recognisable from its filled silhouette alone at 32x32. Variants change only the palette or one small accessory, never the outline, so the album's silhouettes stay honest.
  - Creatures and characters keep a single-colour dark outline (selective outlines and detailed shading are for the environment). The outline is what separates them from any background.
  - *Test:* when a design choice is unclear, pick the detail that changes the outline over one that adds interior pixels.
- **Work Shows on the Body** (Pillar: Working creatures)
  - Each shop gets a pose, prop or palette accent on the creature (flour dust at the bakery, a hard hat at construction). A tired creature curls up asleep. It never looks sick, hurt or sad.
  - *Test:* when unsure whether to show state with a HUD icon or the sprite, use the sprite. Use an icon only if the sprite can't carry it at 32px.
- **Rich Worlds, Brighter Creatures** (Pillar: City progression)
  - Environments may be dense: layered foliage, varied canopy hues within one biome, small ground detail (mushrooms, stumps, wildflowers, roots). Each district keeps one dominant hue family and a darker, lower-saturation ground plane.
  - Creatures and characters always sit higher in value and saturation than the ground around them. Detail density stays low directly under and around interactables and creatures; it rises toward the edges.
  - **Bright-ground exception (snow, sand; approved 2026-11-18):** where the ground is lighter than a creature, separation comes from the dark outline and higher saturation instead. Bright ground is capped at 85% L, never pure white (Section 2).
  - Better districts get richer palettes and more layers, never harsher or grimmer ones. Existing flat town art is re-art'd gradually to this standard.
  - *Test:* when a tile or prop competes with a creature for attention, lower its saturation or contrast, or remove detail behind the creature, before touching the creature.
- **Magic Is Light, Not Noise** (Pillar: Atmosphere; visual only, no mechanic implied)
  - Magic is expressed as soft coloured light: drifting motes (pale green/cyan/yellow), glowing glades (additive teal patches), bioluminescent mushrooms, runestone glow. Additive glows are low-alpha and never overlap a creature's face or outline.
  - Magic light is ambient and slow. It never uses a hue or a pulse reserved for UI state or interaction cues.
  - *Test:* when an effect is ambiguous, choose the dimmer, slower, smaller one; if it could be mistaken for a pickup or an alert, cut it.
- **Open:** Social has no principle yet (the prototype is solo). Later it needs one about telling your own creatures apart from other players'. Chibi proportions (big head, small body) are the common language for every player-facing character.
- **Guardrail:** top-down only, never isometric. Hi-bit JRPG references (Eastward, Sea of Stars, Chained Echoes) and the cozy-chibi references (Pokémon, Habbo, Stardew Valley) are borrowed for look and feel. Never copy specific assets, sprites, tiles or compositions; the user's forest reference image is mood reference only. Characters stay chibi; realistic proportions are out.

## 2. Mood & Atmosphere

**Global rules**
- Each state is set apart by **dominant hue + value key + light source**. No two game states share all three (matrix below).
- Mood lives in the environment, light and UI layers. Creatures keep their palette in every state (≤10% of any tint, Section 4).
- Energy ceiling for the whole game: medium. Nothing frantic, nothing urgent. Weather is cozy, never hostile: no storms, lightning, blizzards or screen shake.
- Magic responds to atmosphere. It glows brighter at night and dims in rain. It stays slow and ambient in every state (Section 1 "Magic Is Light, Not Noise").

### Game states

**Exploring (town, harbour, shore, forest)**
- Target: gentle curiosity and wonder. "There's always something tucked in the next corner."
- Lighting: sky light from the clock. Mid contrast, with soft shadows under canopies, eaves and props. Detail is densest at the screen edges and calm around paths and interactables.
- Descriptors: layered, alive, rustling, inviting. Energy: medium-low.
- Carriers: foliage sway (2–3 frame loops), drifting motes in magic areas, water shimmer at the shore, plaza fountain loop, other players passing.

**Catching (tension minigame)**
- Target: held breath, then relief. "Steady... got it!" Tension stays playful, never stressful.
- Lighting: the environment desaturates 20% and gets a soft edge vignette (−15% value at the edges, clamped to the night floor), so the target and bait stay in full colour.
- Descriptors: focused, hushed, playful, taut. Energy: medium (the game's peak), released at the end.
- Carriers: bait glow ring (interaction cue, Section 4), sway frozen around the target, success = short Coin Gold sparkle and a small pop, fail = the creature hops away with a soft puff. No red, no shake.

**Work / shops (interiors, creatures on shift)**
- Target: satisfied busyness. "A warm workshop running itself."
- Lighting: interior tint follows the clock at **half strength**. Each shop has one constant key light that is never tinted (oven, forge, lamp), so shops stay warmer than the street at every hour.
- Descriptors: bustling, warm, purposeful, tidy. Energy: medium (highest steady state).
- Carriers: per-creature work loops, the key light breathing slowly (≥3 s period), stock filling shelves so progress shows in the scene. **Collecting** is a spike under 0.5 s: ready badge bounces, goods arc to the bag, coins tick up, then back to baseline.

**Home / decorating (apartment)**
- Target: safe contentment and ownership. "My place, everyone's home."
- Lighting: warmest, lowest contrast. Lamp pools, slight evening bias by day (curtain-filtered windows). Windows show the live weather and time outside, through glass only.
- Descriptors: snug, personal, soft, settled. Energy: lowest in the game.
- Carriers: creatures curled asleep, slow "Zzz" bob (≥2 s cycle), rain streaks or snow on the window, lamp pools on the floor. Placement-mode grid uses the UI palette (Section 4), never a world hue.

**Menus / album / market**
- Target: quiet pride, then a pull to complete. "Look what I've found, and what's still out there." Market: "clear prices, quick decision."
- Lighting: none. Flat Paper Cream, untinted, highest legibility.
- Descriptors: tidy, archival, proud, clear. Energy: low (album), medium (market).
- Carriers: caught entries in full colour, uncaught = flat Ink Plum silhouette with "?", new catch stamps in with a small thud, Coin Gold price tags.

**Distinctness matrix (game states)**

| State | Dominant hue | Value key | Light source |
|---|---|---|---|
| Exploring | Biome hue family (Section 4) | Mid, mid contrast | Sky (clock + weather) |
| Catching | Exploring, desaturated −20% | Mid, edges darker | Sky + bait cue |
| Shops | Shop hue + warm key | Mid-high | Half-strength clock + untinted key |
| Collecting | Shop + gold accent | Spike | Badge VFX |
| Home | Rose-wood + lamp amber | Mid-low, softest | Lamps (+ window) |
| Menus / album | Paper Cream + plum | High, flat | None |

### Atmosphere states (time of day and weather)
Clock windows (in-game; 1 in-game hour = 1 real minute): **dawn 06:00–07:30, day 07:30–16:30, dusk 16:30–18:00, night 18:00–06:00**. Only "night 18:00–06:00" exists in code today; the dawn and dusk windows are art targets for gameplay to confirm. Tint values: Section 4.

| State | Mood target | Light character | Descriptors | Energy | Carrying elements |
|---|---|---|---|---|---|
| **Dawn** | Fresh start, hopeful | Warm peach-rose, low contrast, long soft shadows | dewy, pastel, quiet, waking | Low → rising | Lamps fade out, mist wisps at low ground, first motes fading, birds/creatures stirring |
| **Day** | Open, sociable, curious | Neutral (no tint), full contrast, short shadows | clear, bright, busy, airy | Medium-low | Full palette, leaf sway, water sparkle, NPC/player bustle |
| **Dusk** | Golden wind-down | Warm amber-orange, mid contrast, long shadows | golden, mellow, glowing, homeward | Low | Windows light up from 17:30, magic glows start to rise, sky-tinted water |
| **Night** | Cozy-magical, safe | Cool indigo, **lower contrast** in the environment, high contrast in light pools | lantern-lit, hushed, glowing, starry | Lowest outdoors | Lit windows and street lamps (amber pools), fireflies near grass/water, magic glow at peak, player lantern pool (approved 2026-11-18) |
| **Rain** | Snug, pensive, "tea weather" | Cool grey-blue, saturation −15%, soft contrast | pattering, glossy, muted, cozy | Low | Diagonal streaks, ground splash, puddle tiles reflecting lights and sky, dripping eaves, lamp pools slightly larger |
| **Snow** | Hushed wonder, festive-quiet | Cool-bright, value lifted, saturation −10%, low contrast | soft, muffled, sparkling-quiet, pristine | Lowest | Slow-falling flakes, snow overlay on ground and roofs, footprints, breath-puff on characters, warm windows pop |

**Combinations (layering order: clock tint → weather → lights → magic)**
- Rainy night: indigo plus desaturation. Streaks are faint in the dark and bright only inside lamp pools. Puddles carry amber reflections, which is the signature image. No extra darkening beyond the night floor.
- Snowy night: the brightest night. Snow takes a lilac-blue moonlight cast and raises the ground value, and warm windows contrast hardest here.
- Rain or snow at dawn/dusk: weather desaturation eats part of the warm cast. Keep a thin warm horizon band (sky/water reflections) so the time stays readable.
- Forest: canopy filters weather (fewer streaks, more drips; snow only in clearings). Night is the forest's showcase (glades, mushrooms and rune stone at peak).
- Interiors: weather is visible only through windows and doors. Interior light is not desaturated by weather.
- Which biomes get which weather (e.g. snow on the shore) is a design call, not an art one.

**Readability rules (every state)**
- Creatures, player characters, interactable outlines and UI never take the weather saturation shift. Creatures take at most 10% of the active tint.
- **Night floor:** environment ground pixels stay ≥ 25% L at full night tint, so the Ink Plum outline (~21% L) remains the darkest value on screen. Biomes with dark ground (forest) use a weaker night tint (Section 4).
- **Bright-ground rule (snow, sand):** where the ground is lighter than a creature's body, separation is carried by the outline and by saturation. Ground snow and sand are capped at 85% L and pure white is banned.
- Particles (rain, snow, motes) render **behind** creatures and characters. Under the creature and in a 4 px halo around it, opacity is capped at 30%.
- Test: greyscale screenshot of each of the 6 atmosphere states with 3 creatures on the darkest and lightest ground. Every creature is identifiable by silhouette.

**"Animals are hiding" cues (visual vocabulary only; which animals hide when is gameplay's call)**
- Rustling bush/tall grass: 2-frame shake every 4–6 s, with a leaf or two dropping.
- Closed burrow: a mound with the hole plugged by leaves, or a dark hole with no eye-shine.
- Tracks: footprints in snow or wet sand leading into cover.
- Water rings: slow ripples on a pond or puddle where something ducked under.
- Shelter silhouettes: a tail tip or ear poking out from under eaves or a log in rain.
- Rule: hiding cues are environmental and ambient. They never use a reserved semantic hue, a UI badge shape, or a pulse faster than 3 s, so they don't read as a pickup or alert.

## 3. Shape Language

**Hierarchy (figure/ground)**
- Hero (creatures, player and NPC characters): round, organic, chibi. **Full single-colour Ink Plum outline.**
- Interactables (bait, stations, bowls, ready goods, doors, shop counters): soft rectangles. Ink Plum outline on the outer edge only.
- Environment (tiles, foliage, props): **selective outlines**, meaning a darker shade of the object's own hue, on the shadow/bottom side only. Detailed shading is allowed.
- **Rule: a full Ink Plum outline means "alive or interactive."** Environment never gets one.
- Serves: Section 1 "Silhouette Is the Species", "Rich Worlds, Brighter Creatures". The eye goes to characters and creatures, then interactables, then the world.

**Characters (player, NPCs, other players)**
- Chibi: head about 45–50% of body height, small body, short limbs. Large readable eyes, up to 3x3 px with one highlight pixel.
- Frame 48x48, character body ≤ 32 px tall, with feet grounded on a consistent baseline.
- Identity is carried by hair silhouette, hat and outfit colour blocks, not by face detail.
- Open (Section 1): telling your own creatures from other players' needs its own marker later.

**Creature silhouettes**
- Base mass: one rounded "bean/loaf" body. **One signature trait per species** reaches the silhouette edge with ≥ 3 px protrusion, for example:
  - Rabbit: tall ears
  - Pigeon: puffed chest, small head, tail fan
  - Cat: triangle ears, curled tail
  - Monkey: long arms, curled tail
  - Sloth: long hooked arms, round sleepy face
  - Pelican: big pouched beak
  - Penguin: upright torpedo body, flipper wings
  - Armadillo: domed, banded shell (the one creature allowed segment lines in its outline)
- Chibi proportions (approved 2026-11-18): head up to 50% of creature height. Eyes 2x2–3x3 px, highlight allowed. The species trait must still read; charm comes from pose and trait, not from shrinking the body to nothing.
- Size: frame 48x48, transparent. Creature body ≤ 32x32 inside the frame. The extra space is for props, tails and animation arcs. Smallest species ≥ 16 px tall; the largest (capybara) up to 34 px.
- View: top-down, 3/4 front-facing. Never isometric.
- Test: the filled silhouette at native size is identifiable with no interior pixels.

**Variants vs work states**
- Variants: palette swap or one accessory ≤ 6x6 px, inside the silhouette or extending ≤ 1 px. Never an outline change.
- Work states may change the outline:
  - Working: upright, asymmetric, prop extends the outline (rolling pin, hard hat, tray).
  - Tired: curled into a near-circle, no prop.
  - Ready: goods icon above the creature or station.
  - Idle: upright, symmetric, no prop.
- Never droop, limp or slump. Rest is a circle, not a collapse.

**Environment geometry**
- Ground and buildings: 32x32 grid-locked. Walls, counters, paths and cobbles align to the grid.
- **Foliage may break the grid.** Canopies are overlapping layered clusters of 2–3 depth bands, with irregular rounded edges and a darker underside. Canopy tops may overhang paths but never cover a creature's face (fade or cut out).
- Soft forms everywhere. Rounded corners, no spikes, no jagged edges, except carved stone (rune stone) and the armadillo's shell bands.
- Density gradient: detail clusters (mushrooms, stumps, wildflowers, roots, pebbles) sit at path edges and screen edges. Within 1 tile of an interactable or a creature's spawn spot, ground tiles use ≤ 3 values.
- Place motifs (each place owns a shape motif):
  - Town streets: rounded cobbles, arched doorways, striped awnings
  - Plaza: circles (fountain basin, round planters, radial paving)
  - Park: blobby canopies, curved paths
  - Harbour: crates, rope coils, bollards, plank lines
  - Shore: long horizontal bands (foam lines, wet-sand edge), soft dune humps
  - Magic forest: tall layered canopy domes, root arches, dome-capped mushrooms, one upright carved rune slab
  - Shops: one hero station shape per shop (arched oven, workbench, sewing table)
  - Apartment: soft rugs, pillows, rounded furniture
  - Planned: lake (one big calm oval, reeds), river (S-curves), countryside (fences, haystacks, field stripes), island (palm fans, round coves)
- City progression adds shapes (awnings, planters, bunting, lamps) and layers. It never removes softness.

**Light, magic and weather shapes**
- Magic: soft round shapes only. Motes are 1–2 px round dots, glows are feathered ellipses, glades are irregular soft blobs. **No stars, diamonds, rings or sparkle crosses.** Those belong to reward and interaction (UI grammar below).
- Magic motion: slow wander or upward drift. Pulse period ≥ 3 s.
- Rain: straight 1 px diagonal streaks of 3–5 px at one fixed angle, plus 2-frame splash ticks.
- Snow: 1–2 px round flakes that fall slowly downward with a gentle sway. They are told apart from magic motes by colour (white vs tinted) and direction (falling vs drifting).
- Light pools (lamps, windows, lantern): ellipses flattened 2:1 on the ground plane, feathered edge.

**UI shape grammar: echoes the world, stands apart in lighting**
- Echo: same pixel grid, same Ink Plum outline, same soft corners.
- Stand apart: flat (no lighting, tint or weather), on a Paper Cream base no place uses as a fill.
- Panels: rounded rectangle, 4 px corner radius at 1x, 2 px plum border, cream fill, 1 px darker-cream inner shade at the bottom.
- Buttons: "loaf" rounded rectangle, 2 px taller at the top, 1 px pressed offset.
- State badges (shape carries state without colour):
  - Ready: circle with goods icon
  - Working: circle with progress ring
  - Tired: crescent with "z"
  - Needs you: speech bubble with "!"
  - Uncaught: "?" on a silhouette
- **Reserved shapes:** 4-point sparkle = reward/catch success. Thin ring bob = interaction cue. Neither is ever used by magic, weather or hiding cues.
- Icons 16x16, same outline rule as creatures.
- Mobile: tap target ≥ 44x44 CSS px. Badges ≥ 12 px rendered. Sprites never below 1x.

## 4. Color System

**Primary palette (7). World and UI anchors.**

| # | Name | Hex | Role and meaning |
|---|---|---|---|
| 1 | Ink Plum | `#3B2A3F` | Universal outline for creatures, characters and interactables. UI text, uncaught silhouette, "needs you" mark. Darkest value (~21% L). Never pure black. |
| 2 | Paper Cream | `#F5ECD7` | UI panel base (`ui.panel`), album paper, badge discs. Never a world fill. |
| 3 | Hearth Orange | `#E07A3C` | Warm surfaces (wood, oven, warm creature accents). Means "comfort". |
| 4 | Lamp Amber | `#FFD27A` | **Light only** (additive): windows, lamps, lantern, dusk glow. Means "safe, home is near". |
| 5 | Canopy Emerald | `#2E8B6E` | Nature anchor: foliage key hue, teal-leaning. |
| 6 | Loam | `#4B5A45` | Ground-plane anchor: darker, low-saturation floor that creatures pop off (~33% L). |
| 7 | Glade Teal | `#5FE6C8` | **Magic light** anchor (additive): moss glades, motes. Means "wonder", never "action". |

**Magic light family (additive only, hue band 140°–192°, plus pale mote yellow)**
- Glade Teal `#5FE6C8`, rune glow `#7DFFA0`, mushroom glow `#4FE0F5` (nudged from `#4FD8FF` to stay out of the Shift Blue band; approved 2026-11-18), motes pale green `#B8F5C8` / pale cyan `#B8EEF5` / pale yellow `#F2F0A8`.
- Magic is always additive, soft-edged, alpha ≤ 40%, period ≥ 3 s. It is never an opaque fill, never on a creature's face or outline, and never inside a badge or ring shape.

**Semantic colours: RESERVED (UI state and interaction)**

| State | Colour | Hex | Non-colour backup |
|---|---|---|---|
| Ready / reward / coins | Coin Gold | `#F5C542` | Circle badge with goods icon or coin disc, 2-frame bounce |
| Working | Shift Blue | `#3F86C6` | Progress ring, upright pose with prop |
| Tired / resting | Dusk Lilac | `#A28FCF` | Crescent "z" badge, curled-circle silhouette |
| Needs you | Ink Plum "!" on cream bubble | — | Speech bubble, one gentle nudge every 3 s, no flashing |
| Uncaught | Ink Plum flat fill | — | "?" mark, no interior pixels |
| Interaction cue (bait, talkable, usable) | Paper Cream ring | `#F5ECD7` | Thin ring bob, 1–2 Hz |
| Danger | none | — | Nothing is dangerous. No red anywhere in UI. |

- **Reservation rule:** a reserved colour means opaque pixels plus a fast pulse (< 2 s). World art may use neighbouring hues only as (a) ≤ 40% saturation fills or (b) additive light ≤ 40% alpha with a period ≥ 3 s.
  - Gold neighbours (lamp amber, mote yellow, ochre, sand) stay soft-edged or desaturated.
  - Blue neighbours (sea) stay ≤ 40% L or shift green-cyan (hue ≤ 195°). Deep sea `#1D6F9C` is allowed on this rule (approved 2026-11-18).
- Shift Blue band = hue 200°–215° at > 45% L. Magic never enters it.
- All badges are a cream disc or bubble with a 2 px plum ring, untinted, so they read on any ground, at night and in weather.

**Creature colour constraints**
- At most 5 colours per sprite, including the outline. 1 px Ink Plum outline, external only. Interior separation uses darker same-hue shades.
- The creature's main hue is ≥ 15 saturation points above the ground directly around it and ≥ 10 points above the foliage.
- Value range: outline ~21% L to highlight ≥ 80% L. Body mid-tones ≥ 45% L, so the creature stays brighter than any night ground.
- No creature main hue in a reserved band (Coin Gold, Shift Blue, Dusk Lilac) at full saturation. Animal-true bases, lifted (grey pigeon, brown rabbit). No fantasy species exist yet; if one is added it may base on one primary hue outside the reserved bands.
- Shop accents: flour = cream speckle, hard hat = desaturated yellow (not Coin Gold).

**Area palette rules**
- Ground plane: saturation ≤ 40%, value 30–70% L (snow/sand up to 85% L).
- Foliage and structures: saturation ≤ 55%. Accents (flowers, awnings, bunting, fruit): saturation ≤ 65%, ≤ 10% of screen area.
- Each place keeps one dominant hue family. Several canopy hues are allowed if they share value bands.
- City progression: each tier adds ≤ 1 accent hue and +5 saturation to the foliage/accent caps (ground cap fixed). It never gets darker or harsher.

| Area | Temperature | Key colours |
|---|---|---|
| Town streets / plaza | Warm-neutral | Cobble `#8E8378` / `#B3A595`, mortar `#6E645C`, plaster `#E2D2B8`, roof terracotta `#B5664A`, fountain water `#6FB3B8` |
| Park | Neutral-fresh | Grass `#6E9A55` / `#88B067`, path `#CDB892`, canopy `#3F8A5C` |
| Harbour | Cool-neutral | Wet stone `#6E7A80`, planks `#9A7A58`, rope `#C8A878`, harbour water `#2A6A8C` (≤ 40% L) |
| Shore | Split: warm sand / cool sea | Dry sand `#D9C08E`, wet sand `#B49C74`, foam `#E8EEF0` (< 90% L), shallow `#4FA8B0` (green-cyan), deep `#1D6F9C` (36% L) |
| Magic forest | Cool-rich with warm accents | Canopy emerald/teal `#2E8B6E` `#2F7C80`, fig green `#5E8A3A`, deep purple `#5B3A6E`, autumn bush `#C8743A`; floor `#3E4A3A` / Loam `#4B5A45`; glows from the magic family |
| Shop interiors | Warm, one hue per shop | Bakery tans `#D8B48A` `#C99A6E`, counter `#B5835C`. Each new shop: its own hue + an untinted key light |
| Apartment | Warmest, muted | Walls `#C7A58E`, floor `#B48C7A`, trim `#E3CDB8`. **Player furniture follows the ground/accent caps** so a decorated room never out-shouts its creatures. |
| Planned: lake / river | Cool-green, still / cool-lively | Water hue ≤ 195° or ≤ 40% L (Shift Blue rule), reed greens |
| Planned: countryside | Warm-light | Straw, wheat, pale sage |
| Planned: island | Warm-tropical | Sand as shore. Turquoise sea is **opaque and ≤ 55% saturation** so it never reads as Glade Teal magic light. |

**Time-of-day and weather tint values (environment layers only)**

| State | Multiply tint | Saturation | Light pools (additive) | Magic glow alpha |
|---|---|---|---|---|
| Dawn | `#F2C7A5` @ 20% | −5 | fading out | 20% |
| Day | none | 0 | off | 15% |
| Dusk | `#E0A07A` @ 25% | 0 | Lamp Amber on from 17:30, 20% | 25% |
| Night | `#5A5A9C` @ 40% (forest 30%) | −10 | Lamp Amber 30%, player lantern 25% (r ≈ 40 px) | 35–40% |
| Rain (adds) | `#8FA0B5` @ 15% (day) / none (night) | −15 | pools +25% radius, puddles reflect | −10 points |
| Snow (adds) | `#D8E0F0` @ 10% (day) / night tint drops to 30% | −10 | unchanged | unchanged |

- Transitions lerp over 30 in-game minutes (30 real seconds). Windows show the transition at the window only.
- Interiors: clock tint at half strength. Key lights and weather never tint interiors.
- Creatures and characters: ≤ 10% of the active multiply tint, no saturation shift. Interactable outlines, badges and UI: untinted.
- Clamp after combining: ground ≥ 25% L (night floor), ≤ 85% L (bright-ground cap).
- Rain streaks: `#C8D8E8` @ 35% (day), @ 20% outside / 60% inside light pools (night). Snowflakes: `#F4F7FF`, ground snow `#DCE6F0` with lilac shadow `#B8C2DC`. Fireflies: `#E8F59A` (lime-leaning, not Coin Gold), 1 px, ≥ 3 s fade.

**UI palette (diverges from the world)**
- Panel `#F5ECD7`, panel shade `#E3D3B5`, border/text `#3B2A3F`, disabled `#B9AE9C`, semantic Gold/Blue/Lilac. Market awning stripe: Hearth Orange + Paper Cream.
- Divergence: UI is flat, untinted by clock or weather, and uses Cream as a fill, which the world never does. It contains no magic hues and no glow.
- Text contrast: Plum on Cream ≈ 12:1 (AAA). Never text on a semantic colour without cream backing or a plum outline.

**Colourblind safety: risky pairs**

| Pair | Fails for | Required backup |
|---|---|---|
| Working blue vs tired lilac | Protan / deutan | Ring vs crescent badge. Upright-with-prop vs curled silhouette. Ring fills; tired bobs slowly. |
| Working blue vs magic cyan / sea | Protan / tritan | Blue only on cream-disc badges with a plum ring. Magic is soft-edged and never ring-shaped. Sea ≤ 40% L. |
| Gold badge vs lamp amber / mote yellow / fireflies | Deutan / tritan | Gold is only an opaque disc fill with a 2-frame bounce. Lights are feathered and slow. Fireflies lean lime. |
| Gold badge vs green canopy/grass | Deutan | Badges always on a cream disc with a plum ring. |
| Tired lilac vs night tint | All (same family) | Badges untinted, on a cream disc. |
| Snow ground vs cream panel | Low value contrast | Panels keep the 2 px plum border. |

- Verification: each game state × each atmosphere state (incl. rainy night, snowy night) through greyscale and protan/deutan/tritan simulation. Every state must be identifiable by badge shape and pose alone, and every creature by silhouette.
- Hex values are starting targets. Check them in the Phaser prototype against real sprites before treating them as final.

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
