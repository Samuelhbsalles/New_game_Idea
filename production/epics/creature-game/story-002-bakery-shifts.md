# Story 002: Bakery shifts

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 3

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 3; Player goal & fail state), scoped to this story:*

- [ ] The bakery has 6 job slots (count from JSON). A creature can be placed only in a free slot, and only if it isn't already working.
- [ ] A shift lasts the JSON shift length (4 hours) and is measured from stored timestamps, so it completes while the game is closed.
- [ ] Bread produced = creature base production × bakery affinity × shift hours. Monkey produces 4x the generalist rabbit. All values come from JSON.
- [ ] A visible countdown shows the time left on each occupied slot. A bare DOM or Phaser text UI is acceptable.
- [ ] A finished shift can be collected: the bread goes to the inventory, the slot frees, and the creature goes home tired.
- [ ] Collecting before the shift ends gives nothing and leaves the shift running.

---

## Implementation Notes

- Shift rules live in `src/logic/`. The countdown UI only reads state.

---

## Out of Scope

- Story 003: selling bread
- Story 004: energy cost and resting

---

## Files

- `src/logic/` (shifts)
- `src/data/shops.json`, `src/data/creatures.json`
- `tests/unit/logic/story-002-bakery-shifts.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/logic/story-002-bakery-shifts.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-001-logic-core.md`
- Unlocks: `production/epics/creature-game/story-003-economy.md`, `production/epics/creature-game/story-004-energy.md`
