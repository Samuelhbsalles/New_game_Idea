# ADR-0001: Online architecture — Colyseus server, shared rules, platform identity

**Status:** Accepted (2026-11-13)
**Deciders:** project owner, with Claude Code

## Context

The Game Bible describes a social online game (Habbo + Pokémon): a shared town
map where players see each other, workplaces with **6 slots shared by every
player on the server** (one per player per shop), a player market, player shops
that sell while the owner is offline, and visits to each other's homes.

The prototype (design/game-brief.md) was scoped solo: the browser held the save
in localStorage and ran every rule. Building more systems that way (dialogue,
trust, NPC homes) would mean writing each one twice. The game will be published
on a web games platform (CrazyGames, Poki or Discord Activities — not decided),
which logs players in; the game itself never handles passwords.

## Decision

1. **Server:** Colyseus 0.18 (open source, MIT) on Node + TypeScript, in
   `server/`. In development it runs inside Vite's dev server through the
   `colyseus/vite` plugin: one `npm run dev`, one port, no proxy.
2. **Shared rules:** `src/logic/` stays free of Phaser and the DOM (already
   enforced by tests) and is imported by both the client and the server, so
   the server can run the same rules instead of a second implementation.
3. **Identity:** a pluggable `IdentityProvider` (`server/src/identity/`). The
   client sends a token `<platform>:<token>`; the server picks the provider by
   prefix and verifies it. `dev` (name only) exists for development and is
   disabled when `NODE_ENV=production` unless `DEV_LOGIN=1`. A provider per
   platform (CrazyGames JWT, Poki token, Discord OAuth) is added when the
   platform is chosen.
4. **Persistence:** SQLite through Node's built-in `node:sqlite` (no native
   add-on) in `server/data/world.sqlite` (gitignored); one row per account
   keyed by (platform, platform user id), holding the save JSON. Postgres is
   the planned move for production; the store is behind `AccountStore`.
5. **Save format unchanged:** the server stores and validates the same
   serialized `GameState` (`src/logic/state.ts` `deserialize`) the client
   already used, so the client's `Storage` interface simply gets a
   `RemoteStorage` implementation.

## Phases

1. **Skeleton (this ADR's first delivery):** server, dev login, saves in the
   database, one-time import of the browser save into a new account,
   `?offline=1` dev mode without the server.
2. **See each other:** player positions and names in the town room.
3. **Server decides:** catching, buying/selling and shifts become requests the
   server applies with the shared rules (random rolls and time on the server).
4. **Shared slots:** 6 stations per workplace, visible to all, one per player.

## Alternatives considered

- **PHP backend:** rejected. The rules are TypeScript; PHP means a second
  implementation of every rule, and real-time presence (WebSockets) is awkward.
- **Stay solo, add online at the end:** rejected. Every system built
  client-authoritative before then would be rewritten.
- **Hosted backends (Firebase and similar):** workable for saves, weak for a
  real-time shared map and server-side rules; adds vendor lock-in.
- **Plain `ws` without a framework:** more code for rooms, matchmaking,
  reconnection and state sync that Colyseus already provides.

## ADR Dependencies

None (first ADR). Later ADRs on server-authoritative rules (phase 3) and
shared slots (phase 4) will depend on this one.

## Engine Compatibility

- Phaser 3.90.0 client unchanged; only the save `Storage` and the title login
  are new. The Colyseus client SDK (`@colyseus/sdk` 0.18.8) is
  engine-agnostic and bundles with Vite 8.
- Server: `colyseus` 0.18.10 (`@colyseus/core` 0.18.x, `@colyseus/schema` 5.x),
  `@colyseus/testing` 0.18.6, Node 26.13 (smoke-tested, not an LTS).

## GDD Requirements Addressed

From design/GAME_BIBLE.md (the design record at the minimal workflow tier):
- "Social: mapa online compartilhado, vagas disputadas, mercado, lojinhas e
  visitas" — foundation: accounts, server-held saves, a shared world room.
- "Vagas compartilhadas: 6 vagas … usadas por todos os jogadores do servidor"
  — enabled by server-side state (phase 4).
- Offline progress (game-brief "Testable" line) — kept: shifts still run on
  stored timestamps, now held by the server.

## Consequences

- The dev server now also runs the game server; tests boot their own server
  with `@colyseus/testing` (the Vite plugin is off under Vitest).
- Until phase 3, rules still run in the browser: a player could tamper with
  their own save. Acceptable in development; must be closed before any public
  release.
- Hosting is needed before launch (a small VPS in the region of most players:
  São Paulo for Brazil, Dublin/London/Frankfurt for Europe).
- Colyseus 0.18 is newer than the assistant's training data; its docs were
  read on 2026-11-13 and Node 26 was smoke-tested (it is not listed as
  supported — the docs ask for an LTS).
