# Story 001: Logic core, JSON config and storage

> **Epic**: Creature Game
> **Status**: In Progress
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 7

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 7; Player goal & fail state), scoped to this story:*

- [ ] All game rules live in `src/logic/`, and no file there imports Phaser or touches the DOM.
- [ ] Creatures, shops, items, prices and shift length load from JSON files in `src/data/`. No gameplay number is hardcoded in logic.
- [ ] Time comes from an injected clock (`now(): number`, ms timestamps), never `Date.now()` called directly inside logic.
- [ ] Game state saves and loads through a `Storage` interface. The first adapter is localStorage, and an in-memory adapter exists for tests.
- [ ] Save → load round-trip returns an equal game state.
- [ ] Offline progress: a shift started at T, with state saved and the clock advanced past T + shift length, reports complete on load. (This criterion proves the timestamp model; the full shift rules are story 002.)
- [ ] A missing or corrupt save starts a fresh game and never throws.

---

## Implementation Notes

- Propose the folder structure and data model to the user before writing code (the user asked for this first).
- Keep logic pure and serialisable (plain objects), so it can move to a server later.
- Version the save format (`saveVersion` field).

---

## Out of Scope

- Story 002: shift rules, slots, production amounts
- Story 003: coins and buying/selling
- Story 004: energy

---

## Files

- `src/logic/types.ts`
- `src/logic/clock.ts`
- `src/logic/storage.ts`
- `src/logic/memoryStorage.ts`
- `src/logic/localStorageAdapter.ts`
- `src/logic/config.ts`
- `src/logic/state.ts`
- `src/logic/game.ts`
- `src/data/creatures.json`
- `src/data/shops.json`
- `src/data/items.json`
- `src/data/start.json`
- `tests/unit/logic/story-001-logic-core.test.ts`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/logic/story-001-logic-core.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None
- Unlocks: `production/epics/creature-game/story-002-bakery-shifts.md`, `production/epics/creature-game/story-003-economy.md`, `production/epics/creature-game/story-004-energy.md`
