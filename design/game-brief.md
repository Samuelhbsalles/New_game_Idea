# Game Brief: Creature Game

**One-sentence pitch:** Catch cute creatures with bait, put them to work in city shops on 4-hour shifts, and sell what they make to fill your album.

## Core loop
- Walk the park, find a creature, and catch it with bait.
- Send it to work at the bakery for a 4-hour shift. The shift runs on timestamps, so it continues while you are offline.
- Collect the bread, sell it for coins, then buy bait and food.
- Feed or rest tired creatures so they can work again, and keep catching to fill the album.

## Player goal & fail state — what "working" looks like
- Goal: collect every species in the album and keep the bakery running.
- No fail state. Creatures never die or get sick; a tired creature just stops working until it rests or eats. A session is complete when you have collected a shift's output and put creatures back to work or to rest.
- Testable: a shift started, then closed for 4 hours, pays out on reload.

## MVP — what must exist to be the game
1. Town map (park, bakery, home apartment) with top-down walking and placeholder block sprites. Art loads by naming convention (e.g. `rabbit_walk_down_01.png`).
2. Catching: wild common creatures roam the park, and bait gives a 100% catch. Species are rabbit (generalist), pigeon, cat and monkey (4x bakery affinity).
3. Bakery with 6 job slots: place a creature, run a 4-hour timestamp shift with a visible timer, then collect the bread.
4. Economy: sell goods for coins, buy bait and food.
5. Energy: shifts drain it. Tired creatures recover by resting at home or eating.
6. Album screen: silhouettes for uncaught species, details for caught ones.
7. Foundation: all rules (coins, capture, production, timers) in a render-independent logic module. All creatures, shops, items, prices and shift length come from JSON config. Saves go through a swappable storage interface, with localStorage first.

## Out of scope — not building this
- ~~Multiplayer, shared server, WebSockets, other players on the map.~~ **Now in scope (2026-11-13):** the game is online from here on — see docs/architecture/adr-0001-online-architecture.md.
- Player market and player shops.
- Shops beyond the bakery (cafe, market, factory, hotel, construction, clothing store, animal pharmacy, elder care home).
- Legendary-creature capture minigame, breeding, more cities.
- Creature-vs-creature battles, and creature death or sickness.
- Mobile-friendly layout (later) and final Pixellab art (swapped in later).

## Build order
1. Logic module and JSON config: the data model, timestamp shifts, and the storage interface. This is the riskiest part, so a unit test proves offline progress first.
2. Bakery shift flow: place a creature, run the timer, collect bread, sell it. It can run on a bare UI before any map exists.
3. Energy, feeding and resting.
4. Park and catching: map, walking, bait.
5. Album screen.
6. Town map polish and the naming-convention art loader.

---
**Who it's for / what they feel:** Cozy-game players who like checking in on a little town and a collection that grows while they are away.

**Art & audio direction:** 2D pixel art, 32x32 tiles, top-down camera. Colored-block placeholders now, Pixellab sprites later. Audio is not decided.

**Reference game:** Stardew Valley. The MVP keeps the top-down town walking and nothing else: no farming, no combat.
