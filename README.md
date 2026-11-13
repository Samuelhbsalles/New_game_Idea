# Little Willowbrook

A cozy, social pixel-art game about catching creatures and putting them to
work in a little town. Think **Pokémon meets Habbo**: wander the streets, lure
rabbits and pigeons with the right bait, send them off to bake bread or sew
fabric on real-time shifts, sell what they make, and see other players
doing the same in a shared online town.

> **Status: early prototype, actively in development.** Plenty works and is
> playable locally; plenty is still placeholder or on the roadmap. This README
> only lists what is actually in the game today.

---

## What you can do today

### Your character and home
- **Character creator** — pick a body, hairstyle, top and bottom, plus skin,
  hair and clothing colours. Your look is built from layered sprites at runtime.
- **Your own apartment** in the town's apartment building. Everyone starts
  in the same cosy flat, but each player has their own copy.
- **Decorate it, Habbo-style:** pick furniture up, move it around, pack it
  away and bring it back out (pause menu → Decorate). Pieces can't block the
  door or stand inside each other, and rugs lie underneath everything.
- **A pet** that lives its own life: it wanders, naps in its bed, lounges on
  the armchair, eats from its bowl, asks to be petted, and can follow you
  outside.

### The town
- **A walkable town** with ten buildings (bakery, café, market, factory,
  hotel, construction yard, clothes shop, pet pharmacy, care home and your
  home), a park and a harbour.
- **Ambient life:** townsfolk with their own routines (they visit shops, stop
  to chat, and get grumpy if you keep bumping into them), pigeon flocks that
  land in the plaza and scatter when you run at them, a splashing fountain,
  glowing street lamps and chimney smoke.
- **Fast-travel map** (press `M`) to jump between places.
- **In-game clock:** one in-game day lasts 24 real minutes, with day and night.

### Catching creatures
- Wild creatures appear by **neighbourhood, time of day and rarity**.
  Rabbits roam the park and pigeons come to the plaza.
- **Each species has its own bait.** Commons also take the generic bait;
  rarer creatures need theirs, and rare and epic ones can still slip away.
- The first catch of every species is recorded for the album.
- **28 species are defined** (rarity, habitats, time and weather needs,
  favourite bait, and the jobs each one is good and bad at). So far only the
  **rabbit** and the **pigeon** have art and appear in the world. The rest are
  waiting for their sprites and for new areas (lake, shore, countryside…).

### Working and the economy
- **Nine buildings have interiors** you can walk into, each with three work
  stations.
- **Put a creature to work** at a station: it stands at the oven, workbench
  or sewing table, plays its work animation, and a countdown shows the time
  left. A shift lasts 4 in-game hours, runs on timestamps, and **keeps going
  while the game is closed**.
- **Every species has strengths and weaknesses.** A bee bakes three times
  faster; a beaver builds four times better but is terrible with fabric. The
  rabbit is the steady generalist.
- Shifts produce **bread, planks, stone, coffee beans, fabric or herbs**, or
  pay **coins** at the hotel, care home and market.
- **Market counter:** buy bait and pet food, and sell what your creatures made.

### Online (in progress)
- A **game server** runs alongside the game in development. You log in with
  a name, and your save is stored in a database on the server instead of in
  the browser.
- On your first login, an existing browser save moves into your new account
  automatically.
- **You can see other players.** Everyone in the same place (the town, a
  building or an apartment) appears with their own look and a name tag,
  walking around in real time.
- **Visit your neighbours:** at the apartment building's door, choose a
  player who is online and walk around their apartment as they arranged it.

### Also included
- English and Brazilian Portuguese (switch in Options).
- Crisp pixel-perfect text and integer pixel scaling, so the art stays sharp
  at any window size.

## Controls

| Key | Action |
|---|---|
| Arrow keys | Walk |
| `E` / `Enter` | Interact, confirm |
| `Esc` | Pause menu, back |
| `M` | Town map (in town) |

## Technology

| Part | Tech |
|---|---|
| Game client | [Phaser 3.90](https://phaser.io/) + TypeScript 5.9 |
| Build & dev server | [Vite 8](https://vite.dev/) |
| Game server | [Colyseus 0.18](https://colyseus.io/) (open source, runs inside Vite's dev server) |
| Database | SQLite through Node's built-in `node:sqlite` |
| Tests | [Vitest 5](https://vitest.dev/) and `@colyseus/testing` |
| Art | Generated with [PixelLab](https://pixellab.ai/), then processed by small Python scripts in `tools/asset-pipeline/` |
| Font | [Pixel Operator](https://fontlibrary.org/en/font/pixel-operator) by Jayvee Enaguas (CC0) |

The game rules (shifts, catching, economy, clock) live in `src/logic/`,
free of Phaser and the browser, so the same code can run on the server.
The online architecture is recorded in
[`docs/architecture/adr-0001-online-architecture.md`](docs/architecture/adr-0001-online-architecture.md).

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) with npm. Development currently happens on
  Node 26; an LTS release is recommended.
- [Git](https://git-scm.com/)
- *Optional:* [Python 3](https://www.python.org/), only for the asset
  pipeline scripts in `tools/`.

### Install

```bash
git clone <this repository> new-game-idea
cd new-game-idea
npm install
```

### Run it locally

```bash
npm run dev
```

This starts the game and the game server together and opens
`http://localhost:5173`. Type a name on the title screen to log in. The
server creates a local database at `server/data/world.sqlite` on first run;
it is not committed.

**Handy development URL options:**

| Option | What it does |
|---|---|
| `?offline=1` | Play without the server; the save stays in the browser |
| `?scene=town` (`home`, `creator`) | Skip the title screen and jump straight in |
| `?name=Ana` | Name to log in with when using `?scene=` |
| `?save=test` | Use a separate browser save slot, so testing never touches your real save |

### Other commands

```bash
npm test            # run the test suite (game rules + server)
npm run typecheck   # TypeScript check
npm run build       # production build of the client into dist/
```

**Want company while testing?** With `npm run dev` running,
`node tools/dev/bot.mjs Bo` adds a pretend player named Bo who paces the
street near the town spawn.

A production setup for the game server (hosting, real platform login) is
not in place yet.

## Project structure

```
src/
  logic/        game rules, no Phaser and no DOM (shared with the server)
  scenes/       Phaser scenes: title, creator, home, town, interiors, map, menus
  net/          connection to the game server
  data/         all gameplay data as JSON (creatures, shops, items, town, text)
server/src/     Colyseus server: rooms, identity, accounts database
public/assets/  sprites, rooms, tilesets, UI and fonts
tests/          unit, integration and server tests
design/         game bible, game brief, creature list, art bible
docs/           architecture decisions and engine reference
tools/          asset pipeline and design report scripts
production/     stories, QA evidence screenshots
```

## Development status and roadmap

**Done:** town, home and pet, character creator, building interiors with
work shifts, creature data and bait-based catching, market, game clock,
crisp pixel UI, the first two online steps (server, login, saves in a
database, and seeing other players walk around), apartments with
decorating, and visiting other players' apartments.

**Up next (planned, not built yet):**
- The server applying the game rules itself (fair play), and work stations
  shared by all players
- A furniture shop, bigger apartments to move into, and a classifieds board
  where players sell furniture to each other
- Dialogue with townsfolk, friendship and visiting their homes
- Creature energy and resting, and the album screen
- Sprites for more species, plus new areas (lake, shore, countryside)
- Weather, more towns, and a player market

## Built with Claude Code

Development is assisted by [Claude Code](https://code.claude.com/docs), using
the [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
setup: specialised agents, skills and hooks that live in `.claude/`. Design
documents in `design/` and the session notes guide the work.

If you also use Claude Code here:
- Open it in the **project root** (the folder with `CLAUDE.md` and
  `project.yaml`). Starting in a subfolder skips the project's hooks and rules.
- The hooks need **Bash** (on Windows it comes with Git for Windows) and
  **Python 3**. [`jq`](https://jqlang.github.io/jq/) is recommended.

## Credits and license

- Art: generated with PixelLab.
- Font: Pixel Operator by Jayvee Enaguas, CC0 1.0
  (`public/assets/fonts/PixelOperator-LICENSE.txt`).
- Development framework: Claude Code Game Studios by Donchitos (MIT).

The game's own license has not been decided yet. The `LICENSE` file in this
repository is the MIT license inherited from the Claude Code Game Studios
template.
